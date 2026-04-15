'use strict';

const express = require('express');
const { buildPrompt } = require('../ai/promptEngineering.js');

const VALID_MODES = ['background', 'scene', 'character', 'style'];

// ── DALL-E 3 generation ────────────────────────────────────────────────────────
async function generateWithDallE3(prompt, size) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const validSize = ['1024x1024', '1792x1024', '1024x1792'].includes(size) ? size : '1792x1024';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: validSize,
        response_format: 'url',
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`DALL-E 3 HTTP ${response.status}: ${errData?.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  if (!data?.data?.[0]?.url) throw new Error('DALL-E 3 returned no image URL');
  return { imageUrl: data.data[0].url };
}

// ── Replicate Flux generation ──────────────────────────────────────────────────
async function generateWithReplicateFlux(prompt) {
  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('REPLICATE_API_TOKEN not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=60',
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: '16:9',
            output_format: 'webp',
            num_outputs: 1,
          },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        `Replicate Flux HTTP ${response.status}: ${errData?.detail || JSON.stringify(errData)}`
      );
    }

    const data = await response.json();

    // Handle async prediction — poll until done
    if (data.status === 'processing' || data.status === 'starting') {
      const predictionId = data.id;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: { Authorization: `Token ${apiKey}` },
        });
        const pollData = await poll.json();
        if (pollData.status === 'succeeded' && pollData.output?.[0]) {
          return { imageUrl: pollData.output[0] };
        }
        if (pollData.status === 'failed') {
          throw new Error(`Replicate Flux prediction failed: ${pollData.error || 'Unknown'}`);
        }
      }
      throw new Error('Replicate Flux timed out waiting for result');
    }

    if (data.output?.[0]) return { imageUrl: data.output[0] };
    throw new Error('Replicate Flux returned no output');
  } finally {
    clearTimeout(timeout);
  }
}

// ── Attempt generation with fallback chain ─────────────────────────────────────
async function attemptGeneration(fullPrompt, size) {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await generateWithDallE3(fullPrompt, size);
    } catch (err) {
      console.error('[aiGenerate] DALL-E 3 failed, trying Replicate:', err.message);
    }
  }

  if (process.env.REPLICATE_API_TOKEN) {
    return await generateWithReplicateFlux(fullPrompt);
  }

  throw new Error('No image generation provider configured (OPENAI_API_KEY or REPLICATE_API_TOKEN required)');
}

// ── Log to Supabase (non-fatal) ────────────────────────────────────────────────
async function logGenerationHistory(supabase, userId, mode, prompt, imageUrl) {
  if (!supabase) return;
  try {
    await supabase.from('ai_generation_history').insert({
      user_id: userId,
      mode,
      prompt,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[aiGenerate] Failed to log generation history (non-fatal):', err.message);
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────
module.exports = function (supabase, flexAuth) {
  const router = express.Router();

  // POST /generate — generate a single image
  router.post('/generate', flexAuth, async (req, res) => {
    try {
      const { mode, prompt, style, niche, size } = req.body;

      // Validate inputs
      if (!mode || !VALID_MODES.includes(mode)) {
        return res.status(400).json({
          error: 'invalid_mode',
          message: `mode must be one of: ${VALID_MODES.join(', ')}`,
        });
      }
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          error: 'missing_prompt',
          message: 'prompt is required',
        });
      }

      // Pro gate
      const isPro =
        req.user?.user_metadata?.is_pro === true || req.user?.is_pro === true;
      if (!isPro) {
        return res.status(403).json({
          error: 'pro_required',
          message: 'AI Generate requires a Pro subscription.',
        });
      }

      const fullPrompt = buildPrompt(mode, prompt.trim(), style, niche);
      console.log('[aiGenerate] Generating image:', { mode, style, niche, size });

      const result = await attemptGeneration(fullPrompt, size);

      // Log history — non-fatal
      logGenerationHistory(supabase, req.user?.id || req.user?.sub, mode, fullPrompt, result.imageUrl);

      return res.json({ imageUrl: result.imageUrl, creditsRemaining: 99 });
    } catch (err) {
      console.error('[aiGenerate] POST /generate error:', err.message);
      return res.status(500).json({
        error: 'generation_failed',
        message: err.message || 'Image generation failed. Please try again.',
      });
    }
  });

  // POST /generate-variations — generate up to 3 variations
  router.post('/generate-variations', flexAuth, async (req, res) => {
    try {
      const { mode, prompt, style, niche, size } = req.body;

      if (!mode || !VALID_MODES.includes(mode)) {
        return res.status(400).json({
          error: 'invalid_mode',
          message: `mode must be one of: ${VALID_MODES.join(', ')}`,
        });
      }
      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
          error: 'missing_prompt',
          message: 'prompt is required',
        });
      }

      const isPro =
        req.user?.user_metadata?.is_pro === true || req.user?.is_pro === true;
      if (!isPro) {
        return res.status(403).json({
          error: 'pro_required',
          message: 'AI Generate requires a Pro subscription.',
        });
      }

      const VARIATION_SUFFIXES = [
        'variation one, slightly different composition',
        'variation two, alternate color scheme',
        'variation three, different angle and framing',
      ];

      const basePrompt = buildPrompt(mode, prompt.trim(), style, niche);
      const userId = req.user?.id || req.user?.sub;

      console.log('[aiGenerate] Generating 3 variations');

      // Generate variations sequentially to avoid rate limits
      const variations = [];
      for (let i = 0; i < 3; i++) {
        try {
          const variantPrompt = `${basePrompt}, ${VARIATION_SUFFIXES[i]}`;
          const result = await attemptGeneration(variantPrompt, size);
          variations.push({ imageUrl: result.imageUrl });
          logGenerationHistory(supabase, userId, mode, variantPrompt, result.imageUrl);
        } catch (err) {
          console.error(`[aiGenerate] Variation ${i + 1} failed:`, err.message);
          // Partial results are fine — return what succeeded
        }
      }

      if (variations.length === 0) {
        return res.status(500).json({
          error: 'generation_failed',
          message: 'All variation attempts failed. Please try again.',
        });
      }

      return res.json({ variations });
    } catch (err) {
      console.error('[aiGenerate] POST /generate-variations error:', err.message);
      return res.status(500).json({
        error: 'generation_failed',
        message: err.message || 'Variation generation failed. Please try again.',
      });
    }
  });

  // GET /credits — return credit balance
  router.get('/credits', flexAuth, async (req, res) => {
    try {
      const userId = req.user?.id || req.user?.sub;
      const defaults = { total: 50, used: 0, remaining: 50, resetDate: null };

      if (!supabase || !userId) {
        return res.json(defaults);
      }

      // Query ai_credits table if it exists; fall back to defaults on any error
      const { data, error } = await supabase
        .from('ai_credits')
        .select('total, used, reset_date')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return res.json(defaults);
      }

      const used = data.used || 0;
      const total = data.total || 50;
      return res.json({
        total,
        used,
        remaining: Math.max(0, total - used),
        resetDate: data.reset_date || null,
      });
    } catch (err) {
      console.error('[aiGenerate] GET /credits error:', err.message);
      return res.json({ total: 50, used: 0, remaining: 50, resetDate: null });
    }
  });

  return router;
};
