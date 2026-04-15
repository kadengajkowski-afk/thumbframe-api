// POST /api/ai/auto-thumbnail
// Claude analyzes description → DALL-E 3 generates background → returns layer plan
// Input: { description: string, niche: string }
// Output: { layers: LayerSpec[], colorGrade: string, reasoning: string, backgroundUrl: string }

const express = require('express');

module.exports = function(supabase, flexAuth) {
  const router = express.Router();

  router.post('/auto-thumbnail', flexAuth, async (req, res) => {
    const { description, niche } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const OPENAI_KEY    = process.env.OPENAI_API_KEY;

    // Mock plan when APIs not configured
    if (!ANTHROPIC_KEY) {
      return res.json({
        layers: [
          { type: 'image', name: 'Background', x: 640, y: 360, width: 1280, height: 720, placeholder: true },
          { type: 'text',  name: 'Title',      x: 400, y: 300, width: 600, height: 100, textData: { content: description.slice(0, 40), fontSize: 72, fontWeight: 'bold', color: '#ffffff' } },
          { type: 'image', name: 'Face',       x: 1050, y: 380, width: 380, height: 480, placeholder: true },
        ],
        colorGrade: 'cinematic',
        reasoning: 'Mock plan — add ANTHROPIC_API_KEY to Railway for AI-powered generation.',
        backgroundUrl: null,
      });
    }

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

      // Step 1: Claude designs the layout
      const planMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are a YouTube thumbnail designer. Create a thumbnail layout plan for: "${description}" in the niche: "${niche || 'general'}".

Return JSON only:
{
  "backgroundPrompt": "DALL-E 3 prompt for background (no text, no faces, vivid)",
  "colorGrade": "one of: cinematic|warm_golden|cool_blue|high_contrast|vintage|neon_glow",
  "textLayers": [{ "content": "text", "x": 0-1280, "y": 0-720, "fontSize": 48-120, "color": "#hex" }],
  "reasoning": "brief explanation of design choices",
  "facePlacement": "left|right|center|none"
}`
        }],
      });

      let plan = {};
      try { plan = JSON.parse(planMsg.content[0].text); } catch { plan = {}; }

      // Step 2: Generate background with DALL-E 3 if key available
      let backgroundUrl = null;
      if (OPENAI_KEY && plan.backgroundPrompt) {
        try {
          const fetch = require('node-fetch');
          const imgRes = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'dall-e-3', prompt: plan.backgroundPrompt, n: 1, size: '1792x1024', response_format: 'url' }),
          });
          const imgData = await imgRes.json();
          backgroundUrl = imgData?.data?.[0]?.url || null;
        } catch { /* non-fatal */ }
      }

      // Build layer specs
      const faceX = plan.facePlacement === 'left' ? 200 : plan.facePlacement === 'center' ? 640 : 1050;
      const layers = [
        { type: 'image', name: 'AI Background', x: 640, y: 360, width: 1280, height: 720, placeholder: !backgroundUrl, imageUrl: backgroundUrl },
        ...(plan.textLayers || []).map((t, i) => ({
          type: 'text', name: `Text ${i+1}`, x: t.x || 400, y: t.y || 300,
          width: 700, height: 120,
          textData: { content: t.content || 'Your Title', fontSize: t.fontSize || 72, fontWeight: 'bold', color: t.color || '#ffffff', fontFamily: 'Inter' },
        })),
        ...(plan.facePlacement !== 'none' ? [
          { type: 'image', name: 'Face (upload yours)', x: faceX, y: 380, width: 380, height: 480, placeholder: true }
        ] : []),
      ];

      res.json({ layers, colorGrade: plan.colorGrade || 'cinematic', reasoning: plan.reasoning || '', backgroundUrl });
    } catch (err) {
      console.error('[AUTO-THUMBNAIL] Error:', err.message);
      res.status(500).json({ error: 'Generation failed', message: err.message });
    }
  });

  return router;
};
