'use strict';

// node --test tests/brandKit.test.js
//
// No new test runner — uses node 20's built-in node:test. Covers the URL
// parser (5 formats per Day 31 spec) and the LAB color round-trip path.

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const { _parseChannelInput } = require('../routes/brandKit.js');
const {
  extractColors,
  _rgbToLab,
  _labToHex,
  _kMeansLab,
  _deltaE,
} = require('../lib/extractColors.js');

// ── parseChannelInput — 5 supported formats ───────────────────────────────────

test('parseChannelInput: youtube.com/@handle URL', () => {
  const r = _parseChannelInput('https://www.youtube.com/@MrBeast');
  assert.deepEqual(r, { kind: 'handle', value: '@MrBeast' });
});

test('parseChannelInput: youtube.com/@handle/videos sub-path', () => {
  const r = _parseChannelInput('https://www.youtube.com/@MrBeast/videos');
  assert.deepEqual(r, { kind: 'handle', value: '@MrBeast' });
});

test('parseChannelInput: youtube.com/c/CustomName URL', () => {
  const r = _parseChannelInput('https://www.youtube.com/c/MrBeast6000');
  assert.deepEqual(r, { kind: 'username', value: 'MrBeast6000' });
});

test('parseChannelInput: youtube.com/channel/UC... URL', () => {
  const id = 'UCX6OQ3DkcsbYNE6H8uQQuVA'; // 24 chars (UC + 22)
  const r = _parseChannelInput(`https://www.youtube.com/channel/${id}`);
  assert.deepEqual(r, { kind: 'id', value: id });
});

test('parseChannelInput: raw @handle', () => {
  const r = _parseChannelInput('@MrBeast');
  assert.deepEqual(r, { kind: 'handle', value: '@MrBeast' });
});

test('parseChannelInput: raw UC<22> channel id', () => {
  const id = 'UCX6OQ3DkcsbYNE6H8uQQuVA';
  const r = _parseChannelInput(id);
  assert.deepEqual(r, { kind: 'id', value: id });
});

test('parseChannelInput: empty + garbage returns null', () => {
  assert.equal(_parseChannelInput(''), null);
  assert.equal(_parseChannelInput('not a thing at all'), null);
  assert.equal(_parseChannelInput('https://twitter.com/handle'), null);
});

test('parseChannelInput: bare word treated as handle', () => {
  const r = _parseChannelInput('MrBeast');
  assert.deepEqual(r, { kind: 'handle', value: '@MrBeast' });
});

test('parseChannelInput: m.youtube.com mobile host', () => {
  const r = _parseChannelInput('https://m.youtube.com/@MrBeast');
  assert.deepEqual(r, { kind: 'handle', value: '@MrBeast' });
});

// ── LAB conversions — round-trip + perceptual sanity ─────────────────────────

test('rgbToLab: black → L≈0', () => {
  const [L] = _rgbToLab(0, 0, 0);
  assert.ok(L < 1, `expected near-zero L, got ${L}`);
});

test('rgbToLab: white → L≈100', () => {
  const [L] = _rgbToLab(255, 255, 255);
  assert.ok(L > 99 && L < 101, `expected ~100 L, got ${L}`);
});

test('labToHex: round-trips primary colors within 1 step', () => {
  // Pure-channel colors hit the sRGB gamut edge — round-trip needs tolerance
  // of 1 step per channel because LAB → linear sRGB → quantize is lossy.
  const cases = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000'];
  for (const hex of cases) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lab = _rgbToLab(r, g, b);
    const back = _labToHex(lab);
    const br = parseInt(back.slice(1, 3), 16);
    const bg = parseInt(back.slice(3, 5), 16);
    const bb = parseInt(back.slice(5, 7), 16);
    assert.ok(Math.abs(br - r) <= 1, `${hex} R drifted: ${back}`);
    assert.ok(Math.abs(bg - g) <= 1, `${hex} G drifted: ${back}`);
    assert.ok(Math.abs(bb - b) <= 1, `${hex} B drifted: ${back}`);
  }
});

test('deltaE: identical colors → 0; opposites → large', () => {
  const red  = _rgbToLab(255, 0, 0);
  const red2 = _rgbToLab(255, 0, 0);
  const cyan = _rgbToLab(0, 255, 255);
  assert.equal(_deltaE(red, red2), 0);
  assert.ok(_deltaE(red, cyan) > 100);
});

test('kMeansLab: separates two distinct clusters', () => {
  // Build a sample set of 50 reds + 50 blues, ask for k=2, expect each
  // cluster to land on one of them.
  const samples = [];
  for (let i = 0; i < 50; i++) samples.push(_rgbToLab(220 + (i % 10), 30, 30));
  for (let i = 0; i < 50; i++) samples.push(_rgbToLab(30, 30, 220 + (i % 10)));
  const clusters = _kMeansLab(samples, 2);
  assert.equal(clusters.length, 2);
  // Each cluster should hold roughly half the samples
  for (const cl of clusters) {
    assert.ok(cl.members.length > 30, `unbalanced cluster: ${cl.members.length}`);
  }
});

// ── extractColors: produces valid hex array shape ────────────────────────────

test('extractColors: empty inputs → empty palette + null accent', async () => {
  const result = await extractColors({ avatarUrl: null, thumbnails: [] });
  assert.deepEqual(result, { palette: [], primaryAccent: null });
});

test('extractColors output shape — hex strings only', async () => {
  // Can't network-fetch in unit tests; fake the path by passing zero inputs
  // and asserting the output shape contract holds for that branch.
  const result = await extractColors({ avatarUrl: null, thumbnails: [] });
  assert.equal(typeof result, 'object');
  assert.ok(Array.isArray(result.palette));
  assert.ok(result.primaryAccent === null || /^#[0-9A-F]{6}$/.test(result.primaryAccent));
  for (const hex of result.palette) {
    assert.ok(/^#[0-9A-F]{6}$/.test(hex), `not a hex: ${hex}`);
  }
});
