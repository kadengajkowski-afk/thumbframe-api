const express = require('express');
const { v4: uuidv4 } = require('uuid');

module.exports = function(supabase, flexAuth) {
  const router = express.Router();

  // GET /api/referrals/my-code — get or create referral code for authenticated user
  router.get('/my-code', flexAuth, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const userId = req.user?.id || req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      // Check existing
      const { data: existing } = await supabase
        .from('referrals')
        .select('referrer_code')
        .eq('referrer_id', userId)
        .limit(1)
        .single();

      if (existing?.referrer_code) {
        return res.json({ code: existing.referrer_code });
      }

      // Create new code
      const code = `TF-${uuidv4().slice(0,8).toUpperCase()}`;
      await supabase.from('referrals').insert({
        referrer_id: userId,
        referrer_code: code,
        status: 'pending',
      });
      res.json({ code });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/referrals/dashboard — stats + history
  router.get('/dashboard', flexAuth, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const userId = req.user?.id || req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
      const { data: refs } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      const all = refs || [];
      const clicks = all.reduce((s, r) => s + (r.click_count || 0), 0);
      const signups = all.filter(r => r.referred_user_id).length;
      const conversions = all.filter(r => r.status === 'converted').length;
      const freeMonths = conversions; // 1 free month per conversion

      res.json({ stats: { clicks, signups, conversions, freeMonths }, history: all });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/referrals/track-click — anonymous click tracking
  router.post('/track-click', async (req, res) => {
    if (!supabase) return res.json({ ok: true });
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'code required' });

    try {
      // Increment click_count — use raw SQL since Supabase JS doesn't have increment
      await supabase.rpc('increment_referral_clicks', { p_code: code }).catch(() => {});
      res.json({ ok: true });
    } catch {
      res.json({ ok: true }); // non-fatal
    }
  });

  // POST /api/referrals/claim — called on signup with ref code
  router.post('/claim', flexAuth, async (req, res) => {
    if (!supabase) return res.status(503).json({ error: 'Database not configured' });
    const userId = req.user?.id || req.user?.sub;
    const { code } = req.body;
    if (!userId || !code) return res.status(400).json({ error: 'user and code required' });

    try {
      const { data: ref } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_code', code)
        .single();

      if (!ref) return res.status(404).json({ error: 'Invalid referral code' });
      if (ref.referred_user_id) return res.status(409).json({ error: 'Code already used' });
      if (ref.referrer_id === userId) return res.status(400).json({ error: 'Cannot refer yourself' });

      await supabase
        .from('referrals')
        .update({ referred_user_id: userId, status: 'signed_up', signed_up_at: new Date().toISOString() })
        .eq('referrer_code', code);

      res.json({ ok: true, message: 'Referral claimed!' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
