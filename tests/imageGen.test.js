'use strict';

// node --test tests/imageGen.test.js

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const {
  MODELS,
  VALID_INTENTS,
  detectIntent,
  modelForIntent,
  computeImageGenCost,
} = require('../lib/imageGenModels.js');

const imageGenRoutes = require('../routes/imageGen.js');

// ── Model registry ────────────────────────────────────────────────────────────

test('VALID_INTENTS = three documented intents', () => {
  assert.deepEqual(
    VALID_INTENTS.sort(),
    ['reference-guided', 'text-in-image', 'thumbnail-bg'],
  );
});

test('modelForIntent: thumbnail-bg → Flux Schnell', () => {
  const m = modelForIntent('thumbnail-bg');
  assert.equal(m.falModel, 'fal-ai/flux/schnell');
  assert.equal(m.logIntent, 'image-gen-flux-schnell');
  assert.equal(m.costPerImg, 0.003);
});

test('modelForIntent: text-in-image → Ideogram 3', () => {
  const m = modelForIntent('text-in-image');
  assert.equal(m.falModel, 'fal-ai/ideogram/v3');
  assert.equal(m.logIntent, 'image-gen-ideogram-3');
  assert.equal(m.costPerImg, 0.06);
});

test('modelForIntent: reference-guided → Nano Banana', () => {
  const m = modelForIntent('reference-guided');
  assert.equal(m.falModel, 'fal-ai/flux-pro/kontext');
  assert.equal(m.logIntent, 'image-gen-nano-banana');
  assert.equal(m.costPerImg, 0.02);
});

test('modelForIntent: throws on unknown intent (no silent fallback)', () => {
  assert.throws(() => modelForIntent('nonsense'), /Unknown intent/);
});

// ── detectIntent auto-detection ───────────────────────────────────────────────

test('detectIntent: referenceImage present → reference-guided', () => {
  assert.equal(
    detectIntent({ prompt: 'sunset over mountains', referenceImage: 'b64...' }),
    'reference-guided',
  );
});

test('detectIntent: prompt with "text saying" → text-in-image', () => {
  assert.equal(
    detectIntent({ prompt: 'a thumbnail with text saying "WIN"' }),
    'text-in-image',
  );
});

test('detectIntent: prompt with quoted text → text-in-image', () => {
  assert.equal(
    detectIntent({ prompt: 'gamer hero with title "EPIC WIN"' }),
    'text-in-image',
  );
});

test('detectIntent: prompt with "title:" → text-in-image', () => {
  assert.equal(
    detectIntent({ prompt: 'thumbnail, title: How I made 1M' }),
    'text-in-image',
  );
});

test('detectIntent: bare prompt → thumbnail-bg', () => {
  assert.equal(
    detectIntent({ prompt: 'sunset over mountains, cinematic' }),
    'thumbnail-bg',
  );
});

test('detectIntent: empty prompt → thumbnail-bg (no signal)', () => {
  assert.equal(detectIntent({ prompt: '' }), 'thumbnail-bg');
});

// ── computeImageGenCost ───────────────────────────────────────────────────────

test('computeImageGenCost: thumbnail-bg × 4 = $0.012', () => {
  assert.equal(computeImageGenCost('thumbnail-bg', 4), 0.012);
});

test('computeImageGenCost: text-in-image × 4 = $0.24', () => {
  assert.equal(computeImageGenCost('text-in-image', 4), 0.24);
});

test('computeImageGenCost: reference-guided × 4 = $0.08', () => {
  assert.equal(computeImageGenCost('reference-guided', 4), 0.08);
});

test('computeImageGenCost: floors to at least 1 variant', () => {
  assert.equal(computeImageGenCost('thumbnail-bg', 0), 0.003);
  assert.equal(computeImageGenCost('thumbnail-bg', -5), 0.003);
});

// ── Constants ─────────────────────────────────────────────────────────────────

test('FREE_MONTHLY_LIMIT === 3 (matches BG-remove free trial)', () => {
  assert.equal(imageGenRoutes.FREE_MONTHLY_LIMIT, 3);
});

test('PRO_MONTHLY_LIMIT === 40 (locked pricing)', () => {
  assert.equal(imageGenRoutes.PRO_MONTHLY_LIMIT, 40);
});

test('IMAGE_GEN_INTENTS covers all three models', () => {
  const expected = Object.values(MODELS).map((m) => m.logIntent).sort();
  assert.deepEqual(imageGenRoutes.IMAGE_GEN_INTENTS.sort(), expected);
});

// ── Route: 400 on bad input ───────────────────────────────────────────────────

test('POST /api/image-gen returns 400 when prompt missing', async () => {
  const noopFlexAuth = (req, _res, next) => { req.user = { id: 'u1' }; next(); };
  const router = imageGenRoutes(null, noopFlexAuth);
  const fakeReq = {
    method: 'POST',
    body: {},
    user: { id: 'u1' },
    on: () => {},
  };
  let statusCode = 0;
  let body = null;
  const fakeRes = {
    status(code) { statusCode = code; return this; },
    json(obj)    { body = obj; return this; },
    setHeader()  {},
    flushHeaders() {},
    write()      {},
    end()        {},
  };
  // Find the POST '/' handler
  const layer = router.stack.find((l) => l.route?.path === '/' && l.route.methods.post);
  assert.ok(layer, 'POST / route should be registered');
  const stack = layer.route.stack;
  const handler = stack[stack.length - 1].handle;
  await handler(fakeReq, fakeRes);
  assert.equal(statusCode, 400);
  assert.equal(body.code, 'BAD_INPUT');
});
