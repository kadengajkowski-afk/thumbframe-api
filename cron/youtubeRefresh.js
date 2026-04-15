'use strict';

// Usage: node cron/youtubeRefresh.js
// Refreshes YouTube analytics for all connected channels.
// Schedule via Railway cron or any external cron runner.
// Designed to be safe: per-channel try/catch — one failure never aborts the run.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { google }         = require('googleapis');
const { createClient }   = require('@supabase/supabase-js');

// ── Supabase service client ────────────────────────────────────────────────────
function makeSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }
  return createClient(url, key);
}

// ── OAuth2 client factory ──────────────────────────────────────────────────────
function getOAuth2Client(accessToken, refreshToken) {
  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    `${process.env.API_BASE_URL || 'https://thumbframe-api-production.up.railway.app'}/api/youtube/callback`
  );
  client.setCredentials({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });
  return client;
}

// ── Per-channel refresh ────────────────────────────────────────────────────────
// Extend this function as the full analytics pipeline is built out.
async function refreshChannel(supabase, channel) {
  const { user_id: userId, channel_id: channelId, channel_name: channelName } = channel;

  console.log(`[YOUTUBE REFRESH] Processing channel: "${channelName}" (user: ${userId})`);

  // Look up stored tokens
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('youtube_tokens')
    .select('access_token, refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (tokenErr) {
    throw new Error(`Token lookup failed: ${tokenErr.message}`);
  }
  if (!tokenRow) {
    throw new Error('No stored tokens — user must reconnect YouTube');
  }

  const oauth2Client = getOAuth2Client(tokenRow.access_token, tokenRow.refresh_token);

  // ── Channel statistics refresh ─────────────────────────────────────────────
  const youtube     = google.youtube({ version: 'v3', auth: oauth2Client });
  const channelResp = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    id:   [channelId],
  });

  const channelData  = channelResp.data.items?.[0];
  if (!channelData) {
    throw new Error(`No channel data returned from YouTube API for channel ${channelId}`);
  }

  const subscriberCount = parseInt(channelData.statistics?.subscriberCount || '0', 10);
  const videoCount      = parseInt(channelData.statistics?.videoCount      || '0', 10);

  // Update channel row with fresh stats and last_fetched_at timestamp
  const { error: updateErr } = await supabase
    .from('youtube_channels')
    .update({
      subscriber_count: subscriberCount,
      video_count:      videoCount,
      last_fetched_at:  new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateErr) {
    throw new Error(`Failed to update youtube_channels: ${updateErr.message}`);
  }

  // ── TODO: Fetch video list + analytics when youtube_videos table is ready ──
  // This skeleton is intentionally minimal. Once youtube_videos and full
  // analytics pipeline are confirmed, expand this block:
  //
  //   const uploads = await fetchUploadsPlaylist(youtube, channelData);
  //   const stats   = await fetchVideoStats(youtube, uploads);
  //   const ctr     = await fetchAnalyticsCtr(oauth2Client, channelId);
  //   await upsertVideos(supabase, userId, stats);
  //   await updateAvgCtr(supabase, userId, ctr);

  console.log(
    `[YOUTUBE REFRESH] Done: "${channelName}" — subscribers: ${subscriberCount}, videos: ${videoCount}`
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('[YOUTUBE REFRESH] Starting run at', new Date().toISOString());

  const isConfigured = !!(
    process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET
  );
  if (!isConfigured) {
    console.error('[YOUTUBE REFRESH] YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET not set — aborting');
    process.exit(1);
  }

  let supabase;
  try {
    supabase = makeSupabase();
    console.log('[YOUTUBE REFRESH] Supabase client ready');
  } catch (err) {
    console.error('[YOUTUBE REFRESH] Supabase init failed:', err.message);
    process.exit(1);
  }

  // Fetch channels not refreshed in the last 23 hours
  const cutoff = new Date(Date.now() - 23 * 3600 * 1000).toISOString();
  const { data: channels, error: fetchErr } = await supabase
    .from('youtube_channels')
    .select('*')
    .lt('last_fetched_at', cutoff);

  if (fetchErr) {
    console.error('[YOUTUBE REFRESH] Failed to query youtube_channels:', fetchErr.message);
    process.exit(1);
  }

  if (!channels || channels.length === 0) {
    console.log('[YOUTUBE REFRESH] No channels due for refresh — exiting');
    process.exit(0);
  }

  console.log(`[YOUTUBE REFRESH] ${channels.length} channel(s) due for refresh`);

  let successCount = 0;
  let failureCount = 0;

  for (const channel of channels) {
    try {
      await refreshChannel(supabase, channel);
      successCount++;
    } catch (err) {
      // Never let one channel's failure crash the entire run
      failureCount++;
      console.error(
        `[YOUTUBE REFRESH] Failed for user ${channel.user_id} / channel "${channel.channel_name}":`,
        err.message
      );
    }
  }

  console.log(
    `[YOUTUBE REFRESH] Run complete — success: ${successCount}, failed: ${failureCount}`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[YOUTUBE REFRESH] Unhandled error:', err);
  process.exit(1);
});
