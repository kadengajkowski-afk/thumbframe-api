'use strict';

// ── Day 34 — Railway AI proxy + Claude routing + SSE ─────────────────────────
// POST /api/ai/chat
//   Body: { messages, intent, canvasState?, canvasImage?, userId? }
//   Auth: Authorization: Bearer <supabase access token> (via flexAuth)
//   Resp: text/event-stream — `data: {chunk, type}\n\n` ... `data: [DONE]\n\n`
//
// Pre-stream errors return JSON. Post-stream errors emit a final
// `data: {error}` frame then `[DONE]` so clients can surface them.
//
// Rate limit: free = 5 calls / 24h. Pro = unlimited (Day 38 swaps to
// credit ledger). Counted via SELECT count(*) on ai_usage_events.

const express          = require('express');
const { getSystemPrompt } = require('../lib/aiPrompts.js');
const { computeCost, modelForIntent } = require('../lib/aiCost.js');

const FREE_DAILY_LIMIT = 5;
const MAX_TOKENS = {
  classify:      32,
  edit:          512,
  plan:          1024,
  'deep-think':  4096,
};

function setSseHeaders(res) {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  // Critical for Railway / nginx — without this the proxy buffers the
  // whole response before flushing, which makes the stream feel like
  // a 30s freeze. Pair with explicit res.flushHeaders().
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

function sse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function checkRateLimit(supabase, user) {
  if (user?.is_pro || user?.plan === 'pro' || user?.is_dev) {
    return { allowed: true, remaining: -1 };
  }
  if (!supabase || !user?.id) {
    // No way to check — fail open so the proxy doesn't break when
    // Supabase is misconfigured. ai_usage_events insert will also
    // no-op below; cost just isn't tracked.
    return { allowed: true, remaining: FREE_DAILY_LIMIT };
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('ai_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if (error) {
    console.warn('[AI] rate-limit query failed:', error.message);
    return { allowed: true, remaining: FREE_DAILY_LIMIT };
  }
  const used = count || 0;
  return {
    allowed: used < FREE_DAILY_LIMIT,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    used,
  };
}

async function logUsage(supabase, { user, model, intent, tokensIn, tokensOut }) {
  if (!supabase || !user?.id) return;
  const cost = computeCost(model, tokensIn, tokensOut);
  const { error } = await supabase.from('ai_usage_events').insert({
    user_id:    user.id,
    model,
    intent,
    tokens_in:  tokensIn,
    tokens_out: tokensOut,
    cost_usd:   cost,
  });
  if (error) {
    console.warn('[AI] usage log insert failed:', error.message);
  }
}

module.exports = function makeAiRoutes(supabase, anthropic, flexAuth) {
  const router = express.Router();

  if (!anthropic) {
    router.use((_req, res) => {
      res.status(503).json({ error: 'AI proxy not configured', code: 'NOT_CONFIGURED' });
    });
    console.log('[AI] routes registered (NOT configured — ANTHROPIC_API_KEY missing)');
    return router;
  }

  // POST /chat — SSE stream
  router.post('/chat', flexAuth, async (req, res) => {
    const { messages, intent: rawIntent, canvasImage, tools, canvasState } = req.body || {};
    const intent = ['classify', 'edit', 'plan', 'deep-think'].includes(rawIntent)
      ? rawIntent
      : 'edit';

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages required', code: 'BAD_INPUT' });
    }

    // Rate limit (pre-stream so we can return JSON 429)
    const rate = await checkRateLimit(supabase, req.user);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `You've used your 5 free messages today. Pro is unlimited — upgrade to keep going.`,
        code:  'RATE_LIMITED',
        used:  rate.used,
        limit: FREE_DAILY_LIMIT,
      });
    }

    // Optional vision: prepend canvasImage as an image block to the LAST
    // user message. Only attach when explicitly provided — most chat
    // turns won't carry the canvas to keep token cost down.
    const enrichedMessages = canvasImage
      ? attachCanvasImage(messages, canvasImage)
      : messages;

    const model = modelForIntent(intent);
    const systemPrompt = getSystemPrompt(intent, { canvasState });
    const maxTokens = MAX_TOKENS[intent] || MAX_TOKENS.edit;

    setSseHeaders(res);
    sse(res, { type: 'start', model, intent });

    let tokensIn  = 0;
    let tokensOut = 0;

    try {
      // Day 40 — when caller supplies tools, pass them through. Anthropic
      // emits content blocks of type=tool_use; we extract them from the
      // final message and forward as `tool_call` SSE frames so the
      // frontend executor can run them locally. Streaming tool args
      // (input_json_delta) is the cleanest path long-term, but the
      // Anthropic SDK's `stream.on('text')` only covers text deltas —
      // we surface tool_use blocks at finalMessage time. The user-facing
      // wait is identical because tool args are tiny vs the assistant's
      // text reply.
      const streamArgs = {
        model,
        max_tokens: maxTokens,
        system:     systemPrompt,
        messages:   enrichedMessages,
      };
      if (Array.isArray(tools) && tools.length > 0) {
        streamArgs.tools = tools;
      }
      const stream = await anthropic.messages.stream(streamArgs);

      stream.on('text', (textDelta) => {
        sse(res, { type: 'chunk', text: textDelta });
      });

      const final = await stream.finalMessage();
      tokensIn  = final.usage?.input_tokens  || 0;
      tokensOut = final.usage?.output_tokens || 0;

      // Forward each tool_use content block as a tool_call SSE frame.
      const blocks = Array.isArray(final.content) ? final.content : [];
      for (const block of blocks) {
        if (block && block.type === 'tool_use') {
          sse(res, {
            type: 'tool_call',
            id:    block.id,
            name:  block.name,
            input: block.input,
          });
        }
      }

      sse(res, { type: 'usage', tokensIn, tokensOut });
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const status = err?.status || err?.response?.status || '?';
      const type   = err?.error?.type || err?.name || '?';
      console.warn(`[AI] stream failed (status=${status} type=${type}):`, err.message);
      sse(res, { type: 'error', message: err.message || 'AI request failed' });
      res.write('data: [DONE]\n\n');
      res.end();
    } finally {
      // Always log — even partial responses count toward quota so a hung
      // call doesn't give the user infinite retries.
      void logUsage(supabase, {
        user:      req.user,
        model,
        intent,
        tokensIn,
        tokensOut,
      });
    }
  });

  // GET /usage — current user's usage today (for the panel header).
  router.get('/usage', flexAuth, async (req, res) => {
    const rate = await checkRateLimit(supabase, req.user);
    res.json({
      isPro:     !!(req.user?.is_pro || req.user?.plan === 'pro' || req.user?.is_dev),
      limit:     FREE_DAILY_LIMIT,
      used:      rate.used ?? 0,
      remaining: rate.remaining,
    });
  });

  console.log('[AI] routes mounted: /api/ai/chat (SSE), /api/ai/usage');
  return router;
};

// ── helpers ──────────────────────────────────────────────────────────────────
function attachCanvasImage(messages, canvasImage) {
  // Find the last user message; convert its content to a multipart array
  // with the canvas image prepended. Anthropic vision wants the image
  // BEFORE the text per their docs.
  const out = messages.slice();
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].role !== 'user') continue;
    const orig = out[i];
    const text = typeof orig.content === 'string' ? orig.content : '';
    out[i] = {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type:       'base64',
            media_type: 'image/png',
            data:       canvasImage.replace(/^data:image\/[a-z]+;base64,/, ''),
          },
        },
        { type: 'text', text },
      ],
    };
    break;
  }
  return out;
}

// Test-only exports
module.exports._helpers = { attachCanvasImage, checkRateLimit, FREE_DAILY_LIMIT };
