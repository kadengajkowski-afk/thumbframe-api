'use strict';

const express  = require('express');
const FormData = require('form-data');

// ── Factory ────────────────────────────────────────────────────────────────────
module.exports = function (supabase, flexAuth) {
  const router = express.Router();

  // POST / — remove background from a base64-encoded image
  router.post('/', flexAuth, async (req, res) => {
    try {
      const { imageBase64, fileName } = req.body;

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({
          error: 'missing_image',
          message: 'imageBase64 is required (raw base64, no data: prefix)',
        });
      }

      // Require the remove.bg API key — tell the client to fall back to MediaPipe if absent
      if (!process.env.REMOVE_BG_API_KEY) {
        return res.status(503).json({
          error: 'service_unavailable',
          message: 'remove.bg API key not configured.',
          fallback: 'mediapipe',
        });
      }

      // Convert base64 string to buffer
      let imageBuffer;
      try {
        imageBuffer = Buffer.from(imageBase64, 'base64');
      } catch (err) {
        return res.status(400).json({
          error: 'invalid_base64',
          message: 'Could not decode imageBase64 — ensure it is raw base64 without a data: prefix.',
        });
      }

      // Build multipart form-data for remove.bg
      const form = new FormData();
      form.append('image_file_b64', imageBase64);
      form.append('size', 'auto');

      console.log('[removeBg] Calling remove.bg API, buffer size:', imageBuffer.length);

      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': process.env.REMOVE_BG_API_KEY,
          ...form.getHeaders(),
        },
        body: form,
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
        });
      }

      // remove.bg returns the PNG image directly as binary
      const arrayBuffer = await response.arrayBuffer();
      const resultBase64 = Buffer.from(arrayBuffer).toString('base64');

      // Track usage — non-fatal if supabase is unavailable
      if (supabase) {
        const userId = req.user?.id || req.user?.sub;
        supabase
          .from('bg_removals')
          .insert({
            user_id: userId || null,
            file_name: fileName || null,
            created_at: new Date().toISOString(),
          })
          .then(({ error }) => {
            if (error) {
              console.error('[removeBg] Failed to log usage (non-fatal):', error.message);
            }
          })
          .catch((err) => {
            console.error('[removeBg] Failed to log usage (non-fatal):', err.message);
          });
      }

      return res.json({ imageBase64: resultBase64, format: 'png' });
    } catch (err) {
      console.error('[removeBg] POST / error:', err.message);
      return res.status(500).json({
        error: 'remove_bg_failed',
        message: err.message || 'Background removal failed. Please try again.',
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
