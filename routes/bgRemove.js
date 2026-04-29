'use strict';

// ── Cycle 6 — HD background removal proxy ─────────────────────────────────────
// POST /api/bg-remove
//   Body: { bitmap: <raw base64 PNG>, mode: 'hd' | 'standard' }
//   Auth: Authorization: Bearer <supabase access token> (via flexAuth)
//   Resp: { bitmap: <raw base64 PNG> }
//
// Free tier: 3 trial HD removes/month — converts free → Pro by letting
// users feel the quality before committing. Cost: $0.20 each, max
// $0.60/free user/month.
//
// Pro tier: 100 HD removes/month.
//
// Both quotas enforced via count(*) against ai_usage_events filtered
// by intent='bg-remove-hd'. Logs to ai_usage_events with
// model='removebg', intent='bg-remove-hd' on success.
//
// REMOVE_BG_API_KEY (or REMOVEBG_API_KEY) lives in Railway env. Worst-case
// cost cap = (Pro users × $20) + (free users × $0.60).

const express = require('express');

const PRO_MONTHLY_LIMIT = 100;
const FREE_MONTHLY_LIMIT = 3;
const HD_COST_USD = 0.20;

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
    .eq('intent', 'bg-remove-hd')
    .gte('created_at', since);
  if (error) {
    console.warn('[bg-remove] quota query failed:', error.message);
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

async function logUsage(supabase, user) {
  if (!supabase || !user?.id) return;
  const { error } = await supabase.from('ai_usage_events').insert({
    user_id:    user.id,
    model:      'removebg',
    intent:     'bg-remove-hd',
    tokens_in:  0,
    tokens_out: 0,
    cost_usd:   HD_COST_USD,
  });
  if (error) console.warn('[bg-remove] usage log failed:', error.message);
}

module.exports = function makeBgRemoveRoutes(supabase, flexAuth) {
  const router = express.Router();

  router.post('/', flexAuth, async (req, res) => {
    const { bitmap, mode } = req.body || {};
    if (!bitmap || typeof bitmap !== 'string') {
      return res.status(400).json({
        error: 'bitmap required (raw base64, no data: prefix)',
        code: 'BAD_INPUT',
      });
    }
    if (mode !== 'hd' && mode !== 'standard') {
      return res.status(400).json({
        error: "mode must be 'hd' or 'standard'",
        code: 'BAD_INPUT',
      });
    }

    const apiKey = process.env.REMOVE_BG_API_KEY || process.env.REMOVEBG_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Remove.bg API not configured',
        code: 'NOT_CONFIGURED',
      });
    }

    const user = req.user;
    const isPro = !!(user?.is_pro || user?.plan === 'pro' || user?.is_dev);

    const quota = await checkQuota(supabase, user, isPro);
    if (!quota.allowed) {
      if (isPro) {
        return res.status(429).json({
          error: `${PRO_MONTHLY_LIMIT}/month HD removals used — resets in 30 days`,
          code: 'RATE_LIMITED',
          remaining: 0,
        });
      }
      return res.status(403).json({
        error: `${FREE_MONTHLY_LIMIT} free removes used — upgrade to Pro for ${PRO_MONTHLY_LIMIT}/month`,
        code: 'FREE_LIMIT_REACHED',
        remaining: 0,
      });
    }

    let response;
    try {
      response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key':    apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          image_file_b64: bitmap,
          size:           mode === 'hd' ? 'full' : 'preview',
          format:         'png',
        }),
      });
    } catch (err) {
      console.error('[bg-remove] network error:', err.message);
      return res.status(502).json({
        error: 'Remove.bg unreachable',
        code: 'UPSTREAM_ERROR',
      });
    }

    if (!response.ok) {
      let errMsg = `Remove.bg HTTP ${response.status}`;
      try {
        const body = await response.json();
        errMsg = body?.errors?.[0]?.title || body?.error || errMsg;
      } catch { /* non-JSON */ }
      console.error('[bg-remove] Remove.bg error:', errMsg);
      return res.status(502).json({
        error: errMsg,
        code: 'UPSTREAM_ERROR',
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString('base64');

    // Log usage AFTER success so failures don't burn quota.
    logUsage(supabase, user).catch((err) =>
      console.warn('[bg-remove] usage log error:', err.message),
    );

    return res.json({ bitmap: resultBase64, format: 'png' });
  });

  // GET /quota — current month's HD remaining (free or Pro)
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
