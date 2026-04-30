'use strict';

// node --test tests/ai.test.js

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const { computeCost, modelForIntent, _PRICING } = require('../lib/aiCost.js');
const { getSystemPrompt, _BASE_VOICE, _INTENT_PROMPTS } = require('../lib/aiPrompts.js');
const aiRoutes = require('../routes/ai.js');

// ── Day 40 — getSystemPrompt appends canvasState ─────────────────────────────

test('getSystemPrompt: ignores canvasState (canvas state lives in the user message now)', () => {
  // Day 40 fix-3 — frontend embeds canvas state in the latest user
  // message. The system prompt no longer reads `context.canvasState`.
  const withState = getSystemPrompt('edit', {
    canvasState: { canvas: { width: 1280, height: 720 }, focused_layer_id: 'L1', layers: [] },
  });
  const without = getSystemPrompt('edit');
  assert.equal(withState, without);
});

test('getSystemPrompt: edit prompt carries the worked example with fake IDs', () => {
  const prompt = getSystemPrompt('edit');
  assert.ok(/WORKED EXAMPLE/.test(prompt));
  // The fake ids appear verbatim so the model has a concrete pattern.
  assert.ok(prompt.includes('"abcXYZ123_test"'));
  assert.ok(prompt.includes('set_layer_fill(layer_id="abcXYZ123_test", color="#FF0000")'));
});

test('getSystemPrompt: edit prompt requires every tool call to fill required fields', () => {
  const prompt = getSystemPrompt('edit');
  assert.ok(/REQUIRED FIELDS/.test(prompt));
  assert.ok(/Never emit a tool call with empty or partial input/i.test(prompt));
});

test('getSystemPrompt: edit prompt warns "name is not the id"', () => {
  const prompt = getSystemPrompt('edit');
  assert.ok(/Never confuse them/i.test(prompt));
});

test('getSystemPrompt: color rules still call out #RRGGBB hex format', () => {
  const prompt = getSystemPrompt('edit');
  assert.ok(/#RRGGBB/.test(prompt));
});

test('getSystemPrompt: omits canvas block when context missing', () => {
  const prompt = getSystemPrompt('edit');
  assert.equal(prompt.includes('Current canvas:'), false);
});

test('getSystemPrompt: edit prompt mentions tool capabilities (Day 40)', () => {
  const prompt = getSystemPrompt('edit');
  assert.ok(/tool/i.test(prompt));
  // Phrase wraps over a newline in the source — match across whitespace.
  assert.ok(/never say\s+"I\s*\n?\s*can't"/i.test(prompt));
});

// ── modelForIntent ────────────────────────────────────────────────────────────

test('modelForIntent: classify → Haiku', () => {
  assert.equal(modelForIntent('classify'), 'claude-haiku-4-5-20251001');
});

test('modelForIntent: edit → Sonnet (default)', () => {
  assert.equal(modelForIntent('edit'), 'claude-sonnet-4-6');
});

test('modelForIntent: plan → Sonnet', () => {
  assert.equal(modelForIntent('plan'), 'claude-sonnet-4-6');
});

test('modelForIntent: deep-think → Opus 4.7', () => {
  assert.equal(modelForIntent('deep-think'), 'claude-opus-4-7');
});

test('modelForIntent: unknown intent falls back to Sonnet', () => {
  assert.equal(modelForIntent('???'), 'claude-sonnet-4-6');
  assert.equal(modelForIntent(undefined), 'claude-sonnet-4-6');
});

// ── computeCost ───────────────────────────────────────────────────────────────

test('computeCost: Haiku 4.5 — 1M in + 1M out = $1 + $5', () => {
  const cost = computeCost('claude-haiku-4-5-20251001', 1_000_000, 1_000_000);
  assert.equal(cost, 6);
});

test('computeCost: Sonnet 4.6 — 100K in + 100K out', () => {
  // 0.1 × $3 + 0.1 × $15 = $0.30 + $1.50 = $1.80
  const cost = computeCost('claude-sonnet-4-6', 100_000, 100_000);
  assert.equal(cost, 1.8);
});

test('computeCost: Opus 4.7 — 10K in + 1K out', () => {
  // 0.01 × $15 + 0.001 × $75 = $0.15 + $0.075 = $0.225
  const cost = computeCost('claude-opus-4-7', 10_000, 1_000);
  assert.equal(cost, 0.225);
});

test('computeCost: rounds to 6 decimals (numeric(10,6) Supabase column)', () => {
  // Pick numbers that yield > 6 decimals: 7 in × $3/M = 0.000021
  const cost = computeCost('claude-sonnet-4-6', 7, 0);
  // 7 / 1e6 × 3 = 0.000021 exactly
  assert.equal(cost, 0.000021);
});

test('computeCost: unknown model falls back to Sonnet pricing', () => {
  const known   = computeCost('claude-sonnet-4-6', 1_000_000, 0);
  const unknown = computeCost('claude-bogus-99-99', 1_000_000, 0);
  assert.equal(known, unknown);
});

test('computeCost: zero tokens → 0', () => {
  assert.equal(computeCost('claude-sonnet-4-6', 0, 0), 0);
});

test('PRICING: every entry has positive input + output rates', () => {
  for (const [model, rate] of Object.entries(_PRICING)) {
    assert.ok(rate.input > 0,  `${model} input rate must be positive`);
    assert.ok(rate.output > 0, `${model} output rate must be positive`);
    assert.ok(rate.output >= rate.input, `${model}: output rate should be >= input`);
  }
});

// ── getSystemPrompt ───────────────────────────────────────────────────────────

test('getSystemPrompt: classify returns the classify prompt', () => {
  const p = getSystemPrompt('classify');
  assert.ok(p.includes('classify'));
  assert.ok(p.includes('Output: just the label'));
});

test('getSystemPrompt: edit returns the edit prompt', () => {
  const p = getSystemPrompt('edit');
  assert.ok(p.includes('change one thing'));
});

test('getSystemPrompt: plan returns the plan prompt', () => {
  const p = getSystemPrompt('plan');
  assert.ok(p.includes('exactly 4 options'));
});

test('getSystemPrompt: deep-think returns the deep-think prompt', () => {
  const p = getSystemPrompt('deep-think');
  assert.ok(p.includes('sharpest thinking'));
});

test('getSystemPrompt: unknown intent falls back to edit', () => {
  assert.equal(getSystemPrompt('bogus'), _INTENT_PROMPTS.edit);
});

test('Voice: every prompt includes the BASE_VOICE rules', () => {
  for (const [intent, prompt] of Object.entries(_INTENT_PROMPTS)) {
    assert.ok(prompt.includes('ThumbFriend'), `${intent} missing identity`);
    assert.ok(/opinionated/i.test(prompt), `${intent} missing opinionated rule`);
    assert.ok(prompt.includes('Banned phrases'), `${intent} missing banned-phrases section`);
  }
});

test('Voice: BASE_VOICE bans specific phrases per CLAUDE.md', () => {
  const banned = ['"Oops"', '"Sorry"', '"Welcome back"', '"AI-powered"'];
  for (const phrase of banned) {
    assert.ok(_BASE_VOICE.includes(phrase), `BASE_VOICE missing ban for ${phrase}`);
  }
});

// ── routes/ai.js helpers ──────────────────────────────────────────────────────

const { attachCanvasImage, checkRateLimit, FREE_DAILY_LIMIT } = aiRoutes._helpers;

test('attachCanvasImage: prepends image block to last user message', () => {
  const out = attachCanvasImage(
    [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'reply' },
      { role: 'user', content: 'redesign this' },
    ],
    'data:image/png;base64,SOMEBASE64',
  );
  assert.equal(out.length, 3);
  assert.equal(out[0].content, 'first'); // earlier user message untouched
  assert.equal(out[1].content, 'reply');
  // Last user message becomes multipart
  assert.ok(Array.isArray(out[2].content));
  assert.equal(out[2].content[0].type, 'image');
  assert.equal(out[2].content[0].source.media_type, 'image/png');
  assert.equal(out[2].content[0].source.data, 'SOMEBASE64'); // data: prefix stripped
  assert.equal(out[2].content[1].type, 'text');
  assert.equal(out[2].content[1].text, 'redesign this');
});

test('attachCanvasImage: handles bare base64 (no data: prefix)', () => {
  const out = attachCanvasImage(
    [{ role: 'user', content: 'hi' }],
    'BARE64',
  );
  assert.equal(out[0].content[0].source.data, 'BARE64');
});

test('FREE_DAILY_LIMIT is 5 per spec', () => {
  assert.equal(FREE_DAILY_LIMIT, 5);
});

test('checkRateLimit: pro user always allowed', async () => {
  const result = await checkRateLimit(null, { id: 'x', is_pro: true });
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, -1); // sentinel for unlimited
});

test('checkRateLimit: dev user always allowed', async () => {
  const result = await checkRateLimit(null, { id: 'x', is_dev: true });
  assert.equal(result.allowed, true);
});

test('checkRateLimit: no supabase → fail open', async () => {
  const result = await checkRateLimit(null, { id: 'x' });
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, FREE_DAILY_LIMIT);
});

test('checkRateLimit: under limit → allowed', async () => {
  const fakeSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: 3, error: null }),
        }),
      }),
    }),
  };
  const result = await checkRateLimit(fakeSupabase, { id: 'u1' });
  assert.equal(result.allowed, true);
  assert.equal(result.used, 3);
  assert.equal(result.remaining, 2);
});

test('checkRateLimit: at limit → blocked', async () => {
  const fakeSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: 5, error: null }),
        }),
      }),
    }),
  };
  const result = await checkRateLimit(fakeSupabase, { id: 'u1' });
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test('checkRateLimit: query error → fail open', async () => {
  const fakeSupabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: null, error: { message: 'boom' } }),
        }),
      }),
    }),
  };
  const result = await checkRateLimit(fakeSupabase, { id: 'u1' });
  assert.equal(result.allowed, true);
});
