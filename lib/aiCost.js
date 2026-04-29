'use strict';

// ── Anthropic per-token cost map (Day 34) ─────────────────────────────────────
// Prices in USD per million tokens, sampled from Anthropic public pricing
// at the Claude 4.x family release. Update when pricing changes — single
// source of truth for ai_usage_events.cost_usd.
//
// Day 39 (credit ledger) reads cost_usd from this module to debit balances.

const PRICING = {
  // Haiku 4.5 — cheapest, intent classification + trivial edits
  'claude-haiku-4-5-20251001': { input: 1.0,  output: 5.0  },
  'claude-haiku-4-5':           { input: 1.0,  output: 5.0  },
  // Sonnet 4.6 — default for chat + tool use
  'claude-sonnet-4-6':          { input: 3.0,  output: 15.0 },
  'claude-sonnet-4-6-20250929': { input: 3.0,  output: 15.0 },
  // Opus 4.7 — Deep Think only
  'claude-opus-4-7':            { input: 15.0, output: 75.0 },
};

/** computeCost(model, inputTokens, outputTokens) → USD as a number with
 * 6-decimal precision. Falls back to Sonnet pricing for unknown model
 * ids (rather than throwing) — billing should never block a response. */
function computeCost(model, inputTokens, outputTokens) {
  const rate = PRICING[model] || PRICING['claude-sonnet-4-6'];
  const inCost  = (inputTokens  / 1_000_000) * rate.input;
  const outCost = (outputTokens / 1_000_000) * rate.output;
  // Round to 6 decimals (Supabase column is numeric(10,6))
  return Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
}

/** Resolve an intent string to a Claude model id.
 *   classify    → Haiku 4.5
 *   edit / plan → Sonnet 4.6 (default)
 *   deep-think  → Opus 4.7 */
function modelForIntent(intent) {
  switch (intent) {
    case 'classify':   return 'claude-haiku-4-5-20251001';
    case 'deep-think': return 'claude-opus-4-7';
    case 'edit':
    case 'plan':
    default:           return 'claude-sonnet-4-6';
  }
}

module.exports = {
  computeCost,
  modelForIntent,
  _PRICING: PRICING,
};
