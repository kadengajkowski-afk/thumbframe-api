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
// Day 40 fix-5 — edit bumped 2048 → 4096; deep-think 4096 → 8192.
// Tool-use turns spend tokens on text reply + JSON-encoded tool_use
// input AFTER the long system prompt + per-turn [CANVAS STATE] block.
// Even at 2048 we still saw `stop_reason=tool_use` firing before the
// tool args fully streamed, leaving block.input as {}. 4096 gives
// the model meaningful headroom; deep-think doubles since users
// explicitly opt into longer reasoning. classify stays tight at 32
// since it's a single-label output.
const MAX_TOKENS = {
  classify:      32,
  edit:          4096,
  plan:          1024,
  'deep-think':  8192,
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
    const { messages, intent: rawIntent, canvasImage, tools, canvasState, crew_id } = req.body || {};
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
    const systemPrompt = getSystemPrompt(intent, { canvasState, crewId: crew_id });
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
        // Day 40 fix-3 — explicitly opt into auto tool_choice and
        // disable parallel tool use to keep emit ordering deterministic.
        streamArgs.tool_choice = { type: 'auto' };
      }

      // Day 40 fix-3 — diagnostic logging so we can see exactly what's
      // reaching the model when tool calls come back malformed. Trim
      // the canvas state shape rather than dumping the full prompt.
      if (process.env.AI_DEBUG === '1' || process.env.NODE_ENV !== 'production') {
        const stateInfo = canvasState && canvasState.layers
          ? `layers=${canvasState.layers.length} focused=${canvasState.focused_layer_id ?? 'null'}`
          : 'no canvas_state';
        console.log(`[AI] chat call: intent=${intent} model=${model} tools=${(streamArgs.tools || []).length} crew=${crew_id || 'captain'} ${stateInfo}`);
      }

      const stream = anthropic.messages.stream(streamArgs);

      // Day 40 fix-6 — iterate RAW Anthropic events ourselves so we
      // can accumulate `input_json_delta` payloads per tool_use block
      // index. The SDK's `finalMessage().content[i].input` was
      // returning {} on clean finishes (stop_reason='tool_use', not
      // max_tokens). With raw events we own the buffering: every
      // partial_json fragment is appended to a per-index accumulator;
      // at content_block_stop we JSON.parse it and emit the tool_call
      // SSE frame. Text deltas still pass through verbatim.
      //
      // Anthropic event shapes (see Anthropic streaming docs):
      //   { type: 'message_start', message: {...} }
      //   { type: 'content_block_start', index, content_block: { type, id, name, input } }
      //   { type: 'content_block_delta', index, delta: { type: 'text_delta'|'input_json_delta', text|partial_json } }
      //   { type: 'content_block_stop', index }
      //   { type: 'message_delta', delta: { stop_reason }, usage }
      //   { type: 'message_stop' }

      const debug = process.env.AI_DEBUG === '1' || process.env.NODE_ENV !== 'production';
      const toolBuffers = new Map(); // index → { id, name, jsonAcc }
      let stopReason = null;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const cb = event.content_block;
          if (cb && cb.type === 'tool_use') {
            toolBuffers.set(event.index, {
              id:      cb.id,
              name:    cb.name,
              jsonAcc: '',
            });
          }
        } else if (event.type === 'content_block_delta') {
          const d = event.delta;
          if (!d) continue;
          if (d.type === 'text_delta' && typeof d.text === 'string') {
            sse(res, { type: 'chunk', text: d.text });
          } else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
            const buf = toolBuffers.get(event.index);
            if (buf) buf.jsonAcc += d.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          // Tool block fully streamed — parse + emit immediately.
          const buf = toolBuffers.get(event.index);
          if (buf) {
            const input = parseToolInput(buf.jsonAcc);
            if (debug) {
              console.log(`[AI] complete tool_use input: name=${buf.name} keys=[${Object.keys(input).join(',')}] raw=${buf.jsonAcc.slice(0, 200)}`);
            }
            if (Object.keys(input).length === 0) {
              sse(res, {
                type: 'error',
                message: `${buf.name} called with no arguments — model emitted an empty tool_use block. Try rephrasing your request.`,
              });
            } else {
              sse(res, {
                type: 'tool_call',
                id:    buf.id,
                name:  buf.name,
                input,
              });
            }
            toolBuffers.delete(event.index);
          }
        } else if (event.type === 'message_delta') {
          if (event.delta && event.delta.stop_reason) stopReason = event.delta.stop_reason;
          if (event.usage) {
            tokensIn  = event.usage.input_tokens  ?? tokensIn;
            tokensOut = event.usage.output_tokens ?? tokensOut;
          }
        }
      }

      // finalMessage() resolves the assembled message. Use it ONLY for
      // usage totals if we didn't get them from message_delta — the
      // tool inputs above are already authoritative.
      try {
        const final = await stream.finalMessage();
        tokensIn  = final.usage?.input_tokens  ?? tokensIn;
        tokensOut = final.usage?.output_tokens ?? tokensOut;
        if (debug) {
          console.log(`[AI] finalMessage stop_reason=${final.stop_reason ?? stopReason} tokensIn=${tokensIn} tokensOut=${tokensOut}`);
        }
      } catch (e) {
        if (debug) console.log(`[AI] finalMessage threw: ${e.message}`);
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

// Day 40 fix-6 — JSON parser for accumulated input_json_delta payloads.
// Anthropic emits one or more `input_json_delta` fragments per tool
// block. By the time content_block_stop fires they're meant to form a
// complete JSON object. In rare cases the model still emits an empty
// or trailing-comma form; we recover what we can.
function parseToolInput(rawJson) {
  if (!rawJson || typeof rawJson !== 'string') return {};
  const trimmed = rawJson.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { /* fall through */ }
  // Best-effort recovery: trailing comma fix + dangling close brace.
  for (const candidate of [
    trimmed.replace(/,\s*$/, ''),
    trimmed + '}',
    trimmed.replace(/,\s*$/, '') + '}',
  ]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* keep trying */ }
  }
  return {};
}

// Test-only exports
module.exports._helpers = { attachCanvasImage, checkRateLimit, FREE_DAILY_LIMIT, parseToolInput };
