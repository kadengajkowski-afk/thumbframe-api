'use strict';

// node --test tests/detectFonts.test.js

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const {
  detectFonts,
  _filterFonts,
  _tryParseFontJson,
  _BUNDLED_FONTS,
} = require('../lib/detectFonts.js');

// ── filterFonts ───────────────────────────────────────────────────────────────

test('filterFonts: passes valid in-set entries above confidence floor', () => {
  const out = _filterFonts([
    { name: 'Anton',      confidence: 0.9 },
    { name: 'Bebas Neue', confidence: 0.75 },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { name: 'Anton',      confidence: 0.9 });
  assert.deepEqual(out[1], { name: 'Bebas Neue', confidence: 0.75 });
});

test('filterFonts: drops below-threshold confidence', () => {
  const out = _filterFonts([
    { name: 'Anton', confidence: 0.5 }, // below floor (0.6)
    { name: 'Bebas Neue', confidence: 0.61 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Bebas Neue');
});

test('filterFonts: drops out-of-set fonts', () => {
  const out = _filterFonts([
    { name: 'Impact',  confidence: 0.95 }, // not in our 25-OFL set
    { name: 'Helvetica', confidence: 0.9 },
    { name: 'Anton',   confidence: 0.85 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Anton');
});

test('filterFonts: case-insensitive match, returns canonical casing', () => {
  const out = _filterFonts([
    { name: 'anton',     confidence: 0.9 },
    { name: 'BEBAS NEUE', confidence: 0.85 },
    { name: 'press start 2p', confidence: 0.92 },
  ]);
  assert.deepEqual(out.map((f) => f.name), ['Anton', 'Bebas Neue', 'Press Start 2P']);
});

test('filterFonts: dedupes by canonical name', () => {
  const out = _filterFonts([
    { name: 'Anton', confidence: 0.95 },
    { name: 'anton', confidence: 0.7 }, // dupe — keep first (highest conf)
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].confidence, 0.95);
});

test('filterFonts: caps at 3 entries', () => {
  const out = _filterFonts([
    { name: 'Anton',          confidence: 0.95 },
    { name: 'Bebas Neue',     confidence: 0.9 },
    { name: 'Bangers',        confidence: 0.85 },
    { name: 'Russo One',      confidence: 0.8 },
    { name: 'Squada One',     confidence: 0.75 },
  ]);
  assert.equal(out.length, 3);
});

test('filterFonts: rejects non-array / malformed input', () => {
  assert.deepEqual(_filterFonts(null),               []);
  assert.deepEqual(_filterFonts(undefined),          []);
  assert.deepEqual(_filterFonts({}),                 []);
  assert.deepEqual(_filterFonts('not an array'),     []);
  assert.deepEqual(_filterFonts([null, undefined]),  []);
  assert.deepEqual(_filterFonts([{ name: '' }]),     []);
  assert.deepEqual(_filterFonts([{ confidence: 1 }]),[]);
});

test('filterFonts: clamps confidence to [0, 1]', () => {
  const out = _filterFonts([{ name: 'Anton', confidence: 1.5 }]);
  assert.equal(out[0].confidence, 1);
});

// ── tryParseFontJson ──────────────────────────────────────────────────────────

test('tryParseFontJson: plain JSON string', () => {
  const r = _tryParseFontJson('{"fonts":[{"name":"Anton","confidence":0.9}]}');
  assert.deepEqual(r, { fonts: [{ name: 'Anton', confidence: 0.9 }] });
});

test('tryParseFontJson: strips ```json fences', () => {
  const r = _tryParseFontJson('```json\n{"fonts":[]}\n```');
  assert.deepEqual(r, { fonts: [] });
});

test('tryParseFontJson: extracts JSON from prose preamble', () => {
  const r = _tryParseFontJson('Here is my analysis: {"fonts":[{"name":"Anton","confidence":0.8}]} done.');
  assert.deepEqual(r, { fonts: [{ name: 'Anton', confidence: 0.8 }] });
});

test('tryParseFontJson: returns null on garbage', () => {
  assert.equal(_tryParseFontJson(''), null);
  assert.equal(_tryParseFontJson(null), null);
  assert.equal(_tryParseFontJson('not even close'), null);
});

// ── detectFonts top-level guards ──────────────────────────────────────────────

test('detectFonts: returns [] when anthropic is null', async () => {
  const out = await detectFonts({ anthropic: null, thumbnailUrls: ['x', 'y'] });
  assert.deepEqual(out, []);
});

test('detectFonts: returns [] when thumbnailUrls is empty', async () => {
  // Real anthropic-shaped object — but never reached because the URLs guard fires first.
  const out = await detectFonts({ anthropic: {}, thumbnailUrls: [] });
  assert.deepEqual(out, []);
});

test('detectFonts: bundled-font set matches the canonical 25 OFL list', () => {
  // Sanity gate so the next dev who edits the list sees this break.
  assert.equal(_BUNDLED_FONTS.length, 25);
  assert.ok(_BUNDLED_FONTS.includes('Anton'));
  assert.ok(_BUNDLED_FONTS.includes('Bebas Neue'));
  assert.ok(_BUNDLED_FONTS.includes('Press Start 2P'));
  // Common YouTube fonts NOT in our bundle — Claude should never return these
  // post-filter (and this list documents that intent).
  assert.ok(!_BUNDLED_FONTS.includes('Impact'));
  assert.ok(!_BUNDLED_FONTS.includes('Helvetica'));
});
