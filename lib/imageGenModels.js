'use strict';

// ── Day 37 — fal.ai image generation model registry ──────────────────────────
// Three models routed by intent. Each entry carries:
//   - falModel:   the fal.ai REST endpoint slug
//   - costPerImg: USD per image (matches fal.ai public pricing as of
//                 Cycle 4 — bump when fal moves)
//   - etaSeconds: wall time hint for the loading UX
//   - logIntent:  ai_usage_events.intent string for cost tracking
//
// Intent → model:
//   thumbnail-bg     → Flux Schnell (fast backgrounds, no text)
//   text-in-image    → Ideogram 3 (typography-aware)
//   reference-guided → Nano Banana / Flux Kontext (style transfer)

const MODELS = {
  'thumbnail-bg': {
    falModel:   'fal-ai/flux/schnell',
    costPerImg: 0.003,
    etaSeconds: 3,
    logIntent:  'image-gen-flux-schnell',
    label:      'Flux Schnell',
  },
  'text-in-image': {
    falModel:   'fal-ai/ideogram/v3',
    costPerImg: 0.06,
    etaSeconds: 10,
    logIntent:  'image-gen-ideogram-3',
    label:      'Ideogram 3',
  },
  'reference-guided': {
    falModel:   'fal-ai/flux-pro/kontext',
    costPerImg: 0.02,
    etaSeconds: 5,
    logIntent:  'image-gen-nano-banana',
    label:      'Nano Banana',
  },
};

const VALID_INTENTS = Object.keys(MODELS);

/** Auto-detect intent from prompt text + presence of reference image.
 * - referenceImage present → reference-guided
 * - prompt with explicit text instruction → text-in-image
 * - else → thumbnail-bg */
function detectIntent({ prompt, referenceImage }) {
  if (referenceImage) return 'reference-guided';
  const p = String(prompt || '').toLowerCase();
  // Common signals: "text saying", "title:", quoted text, "the words",
  // "with text", "saying \"...\"".
  const textSignals = [
    /\btext\s+saying\b/,
    /\btitle:\s*["']?/,
    /"[^"]{2,}"/,
    /'[^']{2,}'/,
    /\bthe\s+words?\b/,
    /\bwith\s+text\b/,
    /\bsaying\s+["']/,
    /\bcaption[:\s]/,
  ];
  if (textSignals.some((rx) => rx.test(p))) return 'text-in-image';
  return 'thumbnail-bg';
}

/** Resolve intent → model entry. Throws on unknown intent so callers
 * can return a clean 400 — never a silent fallback that bills the
 * wrong model. */
function modelForIntent(intent) {
  const m = MODELS[intent];
  if (!m) throw new Error(`Unknown intent: ${intent}`);
  return m;
}

/** Per-call USD cost for a given (intent, variant count). */
function computeImageGenCost(intent, variants) {
  const m = modelForIntent(intent);
  const n = Math.max(1, Number(variants) || 1);
  return Math.round(m.costPerImg * n * 1_000_000) / 1_000_000;
}

module.exports = {
  MODELS,
  VALID_INTENTS,
  detectIntent,
  modelForIntent,
  computeImageGenCost,
};
