'use strict';

// ── YouTube OAuth + Data Routes ────────────────────────────────────────────────
// Factory: module.exports = function(supabase, flexAuth) { ... }
// Mount at /api/youtube in index.js:
//   app.use('/api/youtube', require('./routes/youtube.js')(supabase, flexAuthMiddleware));

const express     = require('express');
const { google }  = require('googleapis');

// ── OAuth2 client factory ──────────────────────────────────────────────────────
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    `${process.env.API_BASE_URL || 'https://thumbframe-api-production.up.railway.app'}/api/youtube/callback`
  );
}

// ── Pro check helper ───────────────────────────────────────────────────────────
function isPro(user) {
  return user?.is_pro === true || user?.plan === 'pro';
}

// ── Factory ────────────────────────────────────────────────────────────────────
module.exports = function (supabase, flexAuth) {
  const router = express.Router();

  const isConfigured = !!(
    process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET
  );

  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://thumbframe.com';

  // ── Not-configured guard — short-circuits every route ─────────────────────
  if (!isConfigured) {
    router.use((_req, res) => {
      res.json({ error: 'YouTube integration not configured', configured: false });
    });
    console.log('[YOUTUBE] Routes registered (NOT configured — all endpoints return 503 stub)');
    return router;
  }

  console.log('[YOUTUBE] Routes registered and configured');

  // ── GET /auth-url ──────────────────────────────────────────────────────────
  // Returns the Google OAuth consent-screen URL for the current Pro user.
  router.get('/auth-url', flexAuth, async (req, res) => {
    try {
      if (!isPro(req.user)) {
        return res.status(403).json({ error: 'pro_required' });
      }

      const oauth2Client = getOAuth2Client();
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/youtube.readonly',
          'https://www.googleapis.com/auth/yt-analytics.readonly',
        ],
        state: req.user.id || req.user.sub,
        prompt: 'consent',
      });

      console.log('[YOUTUBE] Auth URL generated for user', req.user.id || req.user.sub);
      return res.json({ authUrl });
    } catch (err) {
      console.error('[YOUTUBE] /auth-url error:', err.message);
      return res.status(500).json({ error: 'Failed to generate auth URL' });
    }
  });

  // ── GET /callback ──────────────────────────────────────────────────────────
  // Google redirects here after the user grants consent.
  // No auth middleware — this is an open redirect endpoint.
  router.get('/callback', async (req, res) => {
    const { code, state: userId, error: oauthError } = req.query;

    if (oauthError) {
      console.error('[YOUTUBE] OAuth error from Google:', oauthError);
      return res.redirect(`${FRONTEND_URL}?youtube=error`);
    }

    if (!code || !userId) {
      console.error('[YOUTUBE] /callback missing code or state');
      return res.redirect(`${FRONTEND_URL}?youtube=error`);
    }

    try {
      const oauth2Client = getOAuth2Client();

      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      console.log('[YOUTUBE] Tokens received for user', userId);

      // Fetch channel info from YouTube Data API
      const youtube     = google.youtube({ version: 'v3', auth: oauth2Client });
      const channelResp = await youtube.channels.list({
        part: ['snippet', 'statistics'],
        mine: true,
      });

      const channel = channelResp.data.items?.[0];

      if (!channel) {
        console.error('[YOUTUBE] /callback — no channel found for user', userId);
        return res.redirect(`${FRONTEND_URL}?youtube=error`);
      }

      const channelId        = channel.id;
      const channelName      = channel.snippet?.title      || '';
      const channelThumbnail = channel.snippet?.thumbnails?.default?.url || '';
      const subscriberCount  = parseInt(channel.statistics?.subscriberCount || '0', 10);
      const videoCount       = parseInt(channel.statistics?.videoCount      || '0', 10);

      if (supabase) {
        // Store channel data (no token columns in youtube_channels per spec)
        const { error: channelErr } = await supabase
          .from('youtube_channels')
          .upsert(
            {
              user_id:           userId,
              channel_id:        channelId,
              channel_name:      channelName,
              channel_thumbnail: channelThumbnail,
              subscriber_count:  subscriberCount,
              video_count:       videoCount,
              last_fetched_at:   new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (channelErr) {
          console.error('[YOUTUBE] /callback — youtube_channels upsert failed:', channelErr.message);
        }

        // Store tokens separately in youtube_tokens table
        const { error: tokenErr } = await supabase
          .from('youtube_tokens')
          .upsert(
            {
              user_id:       userId,
              access_token:  tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              expires_at:    tokens.expiry_date
                ? new Date(tokens.expiry_date).toISOString()
                : null,
            },
            { onConflict: 'user_id' }
          );

        if (tokenErr) {
          console.error('[YOUTUBE] /callback — youtube_tokens upsert failed:', tokenErr.message);
        }

        console.log('[YOUTUBE] Channel + tokens stored for user', userId, '— channel:', channelName);
      } else {
        console.log('[YOUTUBE] /callback — supabase null, skipping storage');
      }

      return res.redirect(`${FRONTEND_URL}?youtube=connected`);
    } catch (err) {
      console.error('[YOUTUBE] /callback error:', err.message);
      return res.redirect(`${FRONTEND_URL}?youtube=error`);
    }
  });

  // ── GET /status ────────────────────────────────────────────────────────────
  // Returns whether the current user has a connected YouTube channel.
  router.get('/status', flexAuth, async (req, res) => {
    try {
      if (!supabase) {
        return res.json({ connected: false, channel: null, configured: false });
      }

      const userId = req.user.id || req.user.sub;

      const { data, error } = await supabase
        .from('youtube_channels')
        .select('channel_id, channel_name, channel_thumbnail, subscriber_count, avg_ctr')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[YOUTUBE] /status query error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch YouTube status' });
      }

      if (!data) {
        return res.json({ connected: false, channel: null });
      }

      return res.json({
        connected: true,
        channel: {
          channelId:        data.channel_id,
          channelName:      data.channel_name,
          channelThumbnail: data.channel_thumbnail,
          subscriberCount:  data.subscriber_count,
          avgCtr:           data.avg_ctr || null,
        },
      });
    } catch (err) {
      console.error('[YOUTUBE] /status error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch YouTube status' });
    }
  });

  // ── GET /videos ────────────────────────────────────────────────────────────
  // Returns the user's recent YouTube videos from the DB cache.
  router.get('/videos', flexAuth, async (req, res) => {
    try {
      if (!isPro(req.user)) {
        return res.status(403).json({ error: 'pro_required' });
      }

      if (!supabase) {
        return res.json({ videos: [] });
      }

      const userId = req.user.id || req.user.sub;

      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('user_id', userId)
        .order('published_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[YOUTUBE] /videos query error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch videos' });
      }

      return res.json({ videos: data || [] });
    } catch (err) {
      console.error('[YOUTUBE] /videos error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch videos' });
    }
  });

  // ── GET /analytics-summary ────────────────────────────────────────────────
  // Returns a summary of channel analytics + top videos for the ThumbFriend panel.
  router.get('/analytics-summary', flexAuth, async (req, res) => {
    try {
      if (!isPro(req.user)) {
        return res.status(403).json({ error: 'pro_required' });
      }

      if (!supabase) {
        return res.json({ connected: false });
      }

      const userId = req.user.id || req.user.sub;

      // Fetch channel row
      const { data: channel, error: channelErr } = await supabase
        .from('youtube_channels')
        .select('channel_name, channel_thumbnail, subscriber_count, avg_ctr')
        .eq('user_id', userId)
        .maybeSingle();

      if (channelErr) {
        console.error('[YOUTUBE] /analytics-summary channel query error:', channelErr.message);
        return res.status(500).json({ error: 'Failed to fetch channel data' });
      }

      if (!channel) {
        return res.json({ connected: false });
      }

      // Fetch top 5 recent videos
      const { data: videos, error: videoErr } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('user_id', userId)
        .order('published_at', { ascending: false })
        .limit(5);

      if (videoErr) {
        console.error('[YOUTUBE] /analytics-summary video query error:', videoErr.message);
        // Non-fatal — return channel data without videos
      }

      return res.json({
        connected:        true,
        channelName:      channel.channel_name,
        channelThumbnail: channel.channel_thumbnail,
        subscriberCount:  channel.subscriber_count,
        avgCtr:           channel.avg_ctr || null,
        topVideos:        videos || [],
      });
    } catch (err) {
      console.error('[YOUTUBE] /analytics-summary error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
  });

  // ── POST /disconnect ───────────────────────────────────────────────────────
  // Removes the user's YouTube connection from both tables.
  router.post('/disconnect', flexAuth, async (req, res) => {
    try {
      const userId = req.user.id || req.user.sub;

      if (supabase) {
        const [channelResult, tokenResult] = await Promise.all([
          supabase.from('youtube_channels').delete().eq('user_id', userId),
          supabase.from('youtube_tokens').delete().eq('user_id', userId),
        ]);

        if (channelResult.error) {
          console.error('[YOUTUBE] /disconnect channels delete error:', channelResult.error.message);
        }
        if (tokenResult.error) {
          // youtube_tokens may not exist yet — log but don't fail
          console.warn('[YOUTUBE] /disconnect tokens delete error:', tokenResult.error.message);
        }
      }

      console.log('[YOUTUBE] User', userId, 'disconnected YouTube');
      return res.json({ ok: true });
    } catch (err) {
      console.error('[YOUTUBE] /disconnect error:', err.message);
      return res.status(500).json({ error: 'Failed to disconnect YouTube' });
    }
  });

  return router;
};
