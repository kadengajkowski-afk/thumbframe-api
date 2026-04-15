const express = require('express');

module.exports = function(supabase, flexAuth) {
  const router = express.Router();

  // GET /api/showcase — public listing
  router.get('/', async (req, res) => {
    if (!supabase) return res.json({ entries: [] });
    const { niche, limit = 20, offset = 0 } = req.query;

    try {
      let query = supabase
        .from('showcase_entries')
        .select('id, user_id, image_url, title, niche, ctr_score, is_featured, views, created_at')
        .eq('is_approved', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (niche) query = query.eq('niche', niche);

      const { data, error } = await query;
      if (error) throw error;
      res.json({ entries: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/showcase — submit entry (auth required)
  router.post('/', flexAuth, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const userId = req.user?.id || req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { image_url, title, niche, ctr_score } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url required' });

    try {
      const { data, error } = await supabase
        .from('showcase_entries')
        .insert({ user_id: userId, image_url, title, niche, ctr_score: Math.min(100, Math.max(0, Number(ctr_score) || 0)) })
        .select()
        .single();

      if (error) throw error;
      res.json({ entry: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/showcase/:id/flag — flag content
  router.post('/:id/flag', flexAuth, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const { id } = req.params;
    // In production, log to a moderation table; for now just acknowledge
    console.log(`[SHOWCASE] Flagged entry ${id} by user ${req.user?.id}`);
    res.json({ ok: true, message: 'Report received. Thank you.' });
  });

  return router;
};
