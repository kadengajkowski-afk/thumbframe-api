'use strict';

const express = require('express');

// ── Factory ────────────────────────────────────────────────────────────────────
module.exports = function (supabase, flexAuth) {
  const router = express.Router();

  // POST / — remove background from a base64-encoded image
  // Expects JSON body: { imageBase64: '<raw base64, no data: prefix>', fileName: '...' }
  router.post('/', flexAuth, async (req, res) => {
    try {
      const { imageBase64, fileName } = req.body;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({
          error: 'missing_image',
          message: 'imageBase64 is required (raw base64, no data: prefix)',
        });
      }

      if (!process.env.REMOVE_BG_API_KEY) {
        return res.status(503).json({
          error: 'service_unavailable',
          message: 'remove.bg API key not configured.',
          fallback: 'mediapipe',
        });
      }

      // Use application/x-www-form-urlencoded + image_file_b64 — avoids the
      // Node 18 native fetch / form-data npm package incompatibility that caused
      // "No image given" errors when using multipart FormData.
      console.log('[removeBg] Calling remove.bg API, base64 length:', imageBase64.length);

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': process.env.REMOVE_BG_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          image_file_b64: imageBase64,
          size:           'full',
          format:         'png',
        }),
      });

      if (!response.ok) {
        let errMsg = `remove.bg HTTP ${response.status}`;
        try {
          const errData = await response.json();
          errMsg = errData?.errors?.[0]?.title || errData?.error || errMsg;
        } catch {}
        console.error('[removeBg] remove.bg API error:', errMsg);
        return res.status(502).json({
          error: 'removebg_api_error',
          message: errMsg,
          fallback: 'mediapipe',
        });
      }

      // remove.bg returns the PNG image directly as binary
      const arrayBuffer = await response.arrayBuffer();
      const resultBase64 = Buffer.from(arrayBuffer).toString('base64');

      console.log('[removeBg] Success, result size:', arrayBuffer.byteLength);

      // Track usage — non-fatal
      if (supabase) {
        const userId = req.user?.id || req.user?.sub;
        supabase
          .from('bg_removals')
          .insert({ user_id: userId || null, file_name: fileName || null, created_at: new Date().toISOString() })
          .then(({ error }) => { if (error) console.error('[removeBg] Usage log failed (non-fatal):', error.message); })
          .catch((err) => { console.error('[removeBg] Usage log failed (non-fatal):', err.message); });
      }

      return res.json({ imageBase64: resultBase64, format: 'png' });
    } catch (err) {
      console.error('[removeBg] POST / error:', err.message);
      return res.status(500).json({
        error: 'remove_bg_failed',
        message: err.message || 'Background removal failed. Please try again.',
        fallback: 'mediapipe',
      });
    }
  });

  // GET /remaining — placeholder credit count
  router.get('/remaining', flexAuth, async (req, res) => {
    try {
      // Placeholder — extend with real DB query once bg_removals quota is tracked
      return res.json({ remaining: 50, total: 50 });
    } catch (err) {
      console.error('[removeBg] GET /remaining error:', err.message);
      return res.status(500).json({ error: 'fetch_failed', message: err.message });
    }
  });

  return router;
};
