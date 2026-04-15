// POST /api/ai/suggest-text
// Claude generates 5 alternative text options for a thumbnail
// Input: { currentText: string, niche: string, videoTitle: string }
// Output: { suggestions: [{ text, strategy, reasoning, ctrImpact }] }

const express = require('express');

module.exports = function(supabase, flexAuth) {
  const router = express.Router();

  const FALLBACK_SUGGESTIONS = [
    { text: 'You WON\'T Believe This', strategy: 'Curiosity Gap', reasoning: 'Creates irresistible urge to click', ctrImpact: '+28%' },
    { text: 'I Tried This For 30 Days', strategy: 'Personal Journey', reasoning: 'Time-bound experiments get high CTR', ctrImpact: '+22%' },
    { text: 'The TRUTH About This', strategy: 'Controversy', reasoning: 'Truth-revealing titles drive curiosity', ctrImpact: '+25%' },
    { text: 'This Changed Everything', strategy: 'Transformation', reasoning: 'Before/after framing is compelling', ctrImpact: '+19%' },
    { text: 'Stop Doing This NOW', strategy: 'Warning', reasoning: 'Negative framing creates urgency', ctrImpact: '+21%' },
  ];

  router.post('/suggest-text', flexAuth, async (req, res) => {
    const { currentText, niche, videoTitle } = req.body;
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_KEY) {
      return res.json({ suggestions: FALLBACK_SUGGESTIONS });
    }

    try {
      const Anthropic = require('@anthropic-ai/sdk');
      const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20250514',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `You are a YouTube thumbnail text expert. Generate 5 alternative thumbnail text options.

Current text: "${currentText || 'none'}"
Video title: "${videoTitle || 'unknown'}"
Niche: "${niche || 'general'}"

Return JSON array only:
[{"text":"short punchy text (max 5 words)","strategy":"Curiosity Gap|Controversy|Personal|Warning|Transformation|Number|Question","reasoning":"one sentence why","ctrImpact":"+X%"}]

Rules: max 5 words per text, ALL CAPS for key words, use numbers when possible, no clickbait lies.`,
        }],
      });

      let suggestions = [];
      try { suggestions = JSON.parse(msg.content[0].text); } catch {}
      if (!Array.isArray(suggestions) || suggestions.length === 0) suggestions = FALLBACK_SUGGESTIONS;

      res.json({ suggestions: suggestions.slice(0, 5) });
    } catch (err) {
      console.error('[SUGGEST-TEXT] Error:', err.message);
      res.json({ suggestions: FALLBACK_SUGGESTIONS });
    }
  });

  return router;
};
