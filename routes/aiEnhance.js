// POST /api/ai/enhance-face
// Uses Replicate API (Real-ESRGAN + GFPGAN) to enhance face quality
// Input: { imageBase64: string (raw base64 JPEG) }
// Output: { enhancedBase64: string } or { error, message } on failure

const express = require('express');

module.exports = function(supabase, flexAuth) {
  const router = express.Router();

  router.post('/enhance-face', flexAuth, async (req, res) => {
    const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
    if (!REPLICATE_TOKEN) {
      return res.status(503).json({
        error: 'service_unavailable',
        message: 'Add REPLICATE_API_TOKEN to Railway environment variables to enable face enhancement.',
      });
    }

    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

    // Pro check
    const isPro = req.user?.is_pro === true || req.user?.plan === 'pro';
    if (!isPro) return res.status(403).json({ error: 'pro_required', message: 'This feature requires a Pro plan.' });

    try {
      // Use Replicate's gfpgan model
      const Replicate = require('replicate');
      const replicate = new Replicate({ auth: REPLICATE_TOKEN });

      const output = await replicate.run(
        'tencentarc/gfpgan:9283608cc6b7be6b65a8e44983db012355f829a539ad21ef73bae4ef2f0096f',
        { input: { img: `data:image/jpeg;base64,${imageBase64}`, version: 'v1.4', scale: 2 } }
      );

      // output is a URL — fetch it and convert to base64
      const fetch = require('node-fetch');
      const imgRes = await fetch(output);
      const buffer = await imgRes.buffer();
      const enhancedBase64 = buffer.toString('base64');

      res.json({ enhancedBase64 });
    } catch (err) {
      console.error('[ENHANCE-FACE] Error:', err.message);
      res.status(500).json({ error: 'Enhancement failed', message: err.message });
    }
  });

  return router;
};
