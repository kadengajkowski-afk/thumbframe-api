'use strict';

// ── Day 37 — fal.ai image generation proxy + SSE ─────────────────────────────
// POST /api/image-gen
//   Body: {
//     prompt: string,
//     intent?: 'thumbnail-bg' | 'text-in-image' | 'reference-guided',
//     variants?: number (1..4, default 4),
//     referenceImage?: string (base64),
//     aspectRatio?: '16:9' | '1:1' | '4:5' (default '16:9')
//   }
//   Auth: Authorization: Bearer <supabase access token> (via flexAuth)
//   Resp: text/event-stream — JSON frames terminated by `data: [DONE]`
//
// Stream frame shapes:
//   { type: 'queued',    intent, model, variants, eta }
//   { type: 'progress',  variant, fraction }    // 0..variants-1
//   { type: 'variant',   variant, url }
//   { type: 'done',      urls: string[] }
//   { type: 'error',     code, message }
//
// Quota: free = 3 image-gen calls / 30 days. Pro = 40 / 30 days.
// Counted via SELECT count(*) on ai_usage_events filtered by intents
// in IMAGE_GEN_INTENTS. Pro overages drain the credit ledger (Day 38).
//
// FAL_API_KEY in Railway env. Each successful generation logs ONE
// ai_usage_events row per call (tokens_out = variant count, cost_usd
// = costPerImg × variants).

const express = require('express');
const {
  detectIntent,
  modelForIntent,
  computeImageGenCost,
  VALID_INTENTS,
} = require('../lib/imageGenModels.js');

const FREE_MONTHLY_LIMIT = 3;
const PRO_MONTHLY_LIMIT  = 40;
const MAX_VARIANTS       = 4;
const VALID_ASPECTS      = new Set(['16:9', '1:1', '4:5']);
const FAL_BASE           = 'https://queue.fal.run';

const IMAGE_GEN_INTENTS = [
  'image-gen-flux-schnell',
  'image-gen-ideogram-3',
  'image-gen-nano-banana',
];

function setSseHeaders(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function checkQuota(supabase, user, isPro) {
  const limit = isPro ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;
  if (user?.is_dev) return { allowed: true, remaining: -1, limit };
  if (!supabase || !user?.id) {
    return { allowed: true, remaining: limit, limit };
  }
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('intent', IMAGE_GEN_INTENTS)
    .gte('created_at', since);
  if (error) {
    console.warn('[image-gen] quota query failed:', error.message);
    return { allowed: true, remaining: limit, limit };
  }
  const used = count || 0;
  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    used,
    limit,
  };
}

async function logUsage(supabase, user, model, variants, costUsd) {
  if (!supabase || !user?.id) return;
  const { error } = await supabase.from('ai_usage_events').insert({
    user_id:    user.id,
    model:      model.falModel,
    intent:     model.logIntent,
    tokens_in:  0,
    tokens_out: variants,
    cost_usd:   costUsd,
  });
  if (error) console.warn('[image-gen] usage log failed:', error.message);
}

/** Map app aspect ratio → fal.ai image_size string. fal models accept
 * either named sizes or {width, height}. We pass named for portability. */
function falImageSize(aspect) {
  switch (aspect) {
    case '1:1': return 'square_hd';
    case '4:5': return 'portrait_4_3';
    case '16:9':
    default:    return 'landscape_16_9';
  }
}

function buildFalInput(intent, { prompt, referenceImage, aspectRatio }) {
  const size = falImageSize(aspectRatio);
  if (intent === 'reference-guided') {
    return {
      prompt,
      image_url: referenceImage
        ? `data:image/png;base64,${referenceImage}`
        : undefined,
      image_size: size,
    };
  }
  if (intent === 'text-in-image') {
    return {
      prompt,
      aspect_ratio: aspectRatio || '16:9',
      style: 'AUTO',
    };
  }
  // thumbnail-bg (Flux Schnell)
  return {
    prompt,
    image_size: size,
    num_inference_steps: 4,
  };
}

/** Submit ONE fal.ai job and poll until done. Resolves to a URL. */
async function generateOne({ apiKey, falModel, input, signal, onProgress }) {
  const submit = await fetch(`${FAL_BASE}/${falModel}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(input),
    signal,
  });
  if (!submit.ok) {
    const txt = await submit.text().catch(() => '');
    throw new Error(`fal submit ${submit.status}: ${txt.slice(0, 200)}`);
  }
  const { request_id, status_url, response_url } = await submit.json();
  if (!request_id) throw new Error('fal: no request_id returned');

  const statusEndpoint = status_url || `${FAL_BASE}/${falModel}/requests/${request_id}/status`;
  const responseEndpoint = response_url || `${FAL_BASE}/${falModel}/requests/${request_id}`;

  // Poll status every 700ms up to 60s.
  const deadline = Date.now() + 60_000;
  let lastStatus = 'IN_QUEUE';
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('aborted');
    await new Promise((r) => setTimeout(r, 700));
    const sres = await fetch(statusEndpoint, {
      headers: { 'Authorization': `Key ${apiKey}` },
      signal,
    });
    if (!sres.ok) continue;
    const s = await sres.json();
    if (s?.status && s.status !== lastStatus) {
      lastStatus = s.status;
      onProgress?.(s.status === 'IN_PROGRESS' ? 0.5 : 0.2);
    }
    if (s?.status === 'COMPLETED') break;
    if (s?.status === 'FAILED') throw new Error('fal generation failed');
  }
  if (Date.now() >= deadline) throw new Error('fal: timed out after 60s');

  const fres = await fetch(responseEndpoint, {
    headers: { 'Authorization': `Key ${apiKey}` },
    signal,
  });
  if (!fres.ok) {
    const txt = await fres.text().catch(() => '');
    throw new Error(`fal response ${fres.status}: ${txt.slice(0, 200)}`);
  }
  const out = await fres.json();
  // fal.ai response shapes vary by model — check the usual fields.
  const url =
    out?.images?.[0]?.url ||
    out?.image?.url ||
    out?.url ||
    null;
  if (!url) throw new Error('fal: missing image URL in response');
  return url;
}

module.exports = function makeImageGenRoutes(supabase, flexAuth) {
  const router = express.Router();

  router.post('/', flexAuth, async (req, res) => {
    const body = req.body || {};
    const prompt = String(body.prompt || '').trim();
    if (!prompt || prompt.length < 3) {
      return res.status(400).json({
        error: 'prompt required (min 3 chars)',
        code: 'BAD_INPUT',
      });
    }
    const variants = Math.min(MAX_VARIANTS, Math.max(1, Number(body.variants) || MAX_VARIANTS));
    const aspectRatio = VALID_ASPECTS.has(body.aspectRatio) ? body.aspectRatio : '16:9';
    const referenceImage = typeof body.referenceImage === 'string' ? body.referenceImage : null;

    let intent = body.intent;
    if (!VALID_INTENTS.includes(intent)) {
      intent = detectIntent({ prompt, referenceImage });
    }

    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'fal.ai API not configured',
        code: 'NOT_CONFIGURED',
      });
    }

    const user = req.user;
    const isPro = !!(user?.is_pro || user?.plan === 'pro' || user?.is_dev);

    const quota = await checkQuota(supabase, user, isPro);
    if (!quota.allowed) {
      if (isPro) {
        return res.status(429).json({
          error: `${PRO_MONTHLY_LIMIT}/month image generations used — top up credits or wait for reset`,
          code: 'RATE_LIMITED',
          remaining: 0,
        });
      }
      return res.status(403).json({
        error: `${FREE_MONTHLY_LIMIT} free generations used — upgrade to Pro for ${PRO_MONTHLY_LIMIT}/month`,
        code: 'FREE_LIMIT_REACHED',
        remaining: 0,
      });
    }

    const model = modelForIntent(intent);
    setSseHeaders(res);

    sse(res, {
      type: 'queued',
      intent,
      model: model.label,
      variants,
      eta: model.etaSeconds * variants,
    });

    const ac = new AbortController();
    req.on('close', () => ac.abort());

    const input = buildFalInput(intent, { prompt, referenceImage, aspectRatio });
    const urls = [];
    let anyFailed = false;

    // Run variants in parallel — each variant is one fal job. We surface
    // each URL as it lands so the UI can populate the grid eagerly.
    await Promise.all(
      Array.from({ length: variants }, async (_, idx) => {
        try {
          const url = await generateOne({
            apiKey,
            falModel: model.falModel,
            input: { ...input, seed: Math.floor(Math.random() * 1e9) },
            signal: ac.signal,
            onProgress: (f) => sse(res, { type: 'progress', variant: idx, fraction: f }),
          });
          urls[idx] = url;
          sse(res, { type: 'variant', variant: idx, url });
        } catch (err) {
          anyFailed = true;
          sse(res, {
            type: 'error',
            variant: idx,
            code: 'UPSTREAM_ERROR',
            message: err.message || 'generation failed',
          });
        }
      }),
    );

    const successful = urls.filter(Boolean);
    if (successful.length === 0) {
      sse(res, { type: 'error', code: 'UPSTREAM_ERROR', message: 'all variants failed' });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Log usage AFTER success so failed runs don't burn quota. Charge
    // for the variants that actually came back (partial-failure-honest).
    const cost = computeImageGenCost(intent, successful.length);
    logUsage(supabase, user, model, successful.length, cost).catch((err) =>
      console.warn('[image-gen] usage log error:', err.message),
    );

    sse(res, { type: 'done', urls: successful, partial: anyFailed });
    res.write('data: [DONE]\n\n');
    return res.end();
  });

  // GET /quota — current month's image-gen remaining
  router.get('/quota', flexAuth, async (req, res) => {
    const user = req.user;
    const isPro = !!(user?.is_pro || user?.plan === 'pro' || user?.is_dev);
    const q = await checkQuota(supabase, user, isPro);
    return res.json({
      isPro,
      used: q.used ?? 0,
      remaining: q.remaining,
      limit: q.limit,
    });
  });

  return router;
};

module.exports.IMAGE_GEN_INTENTS = IMAGE_GEN_INTENTS;
module.exports.FREE_MONTHLY_LIMIT = FREE_MONTHLY_LIMIT;
module.exports.PRO_MONTHLY_LIMIT = PRO_MONTHLY_LIMIT;
