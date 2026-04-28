'use strict';

// ── Brand Kit — public-API-key channel lookup by URL/handle/id ────────────────
// Day 31. Distinct from routes/youtube.js (OAuth flow) — Brand Kit only needs
// PUBLIC channel data, so we authenticate with a server-side API key
// (YOUTUBE_DATA_API_KEY) and skip OAuth entirely. Mounted at /api/youtube
// BEFORE the OAuth router so the /channel-by-url path wins regardless of
// whether OAuth env vars are configured.
//
// Quota cost per extraction: 3 units (channels.list + playlistItems.list +
// videos.list). Default daily quota is 10,000 units → ~3,300 extractions/day.
//
// Day 32: cross-user 24h cache lives in public.shared_brand_kits (Supabase).
// In-memory Map is the L1 cache (1h, per-instance); Supabase is L2 (24h,
// shared across all Railway instances + users).

const express        = require('express');
const fetch          = require('node-fetch');
const { extractColors } = require('../lib/extractColors.js');

const YT_BASE          = 'https://www.googleapis.com/youtube/v3';
const MEM_TTL_MS       = 60 * 60 * 1000;       // L1 (in-process) cache: 1h
const SHARED_TTL_MS    = 24 * 60 * 60 * 1000;  // L2 (Supabase) cache: 24h
const cache            = new Map(); // cacheKey → { data, ts }

// ── Input parsing ─────────────────────────────────────────────────────────────
// 5 supported shapes:
//   youtube.com/@HandleName            → forHandle=@HandleName
//   youtube.com/c/CustomName           → forUsername fallback
//   youtube.com/channel/UC...          → id=UC...
//   raw @HandleName                    → forHandle=@HandleName
//   raw UC<22 chars>                   → id=UC...
function parseChannelInput(raw) {
  const input = (raw || '').trim();
  if (!input) return null;

  // Bare channel id ("UC..." 24 chars total)
  if (/^UC[A-Za-z0-9_\-]{22}$/.test(input)) {
    return { kind: 'id', value: input };
  }

  // Bare handle ("@name")
  if (input.startsWith('@')) {
    return { kind: 'handle', value: input };
  }

  // Bare word that doesn't look like a URL (no protocol, no dot) → handle.
  // Has to come BEFORE the URL parser, because `new URL("https://MrBeast")`
  // happily parses MrBeast as a hostname and we'd reject it as non-YouTube.
  const looksLikeUrl = input.includes('.') || input.startsWith('http');
  if (!looksLikeUrl && /^[A-Za-z0-9_.\-]+$/.test(input)) {
    return { kind: 'handle', value: `@${input}` };
  }

  // Try as URL
  let u;
  try {
    u = new URL(input.startsWith('http') ? input : `https://${input}`);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtu.be') {
    return null;
  }

  // /channel/UC...
  const channelMatch = u.pathname.match(/^\/channel\/(UC[A-Za-z0-9_\-]{22})/);
  if (channelMatch) {
    return { kind: 'id', value: channelMatch[1] };
  }

  // /@HandleName
  const handleMatch = u.pathname.match(/^\/(@[A-Za-z0-9_.\-]+)/);
  if (handleMatch) {
    return { kind: 'handle', value: handleMatch[1] };
  }

  // /user/UserName (legacy)
  const userMatch = u.pathname.match(/^\/user\/([A-Za-z0-9_.\-]+)/);
  if (userMatch) {
    return { kind: 'username', value: userMatch[1] };
  }

  // /c/CustomName — YouTube no longer exposes a canonical lookup. Try
  // forUsername; clients see the failure if it doesn't resolve and can
  // paste the @handle instead.
  const customMatch = u.pathname.match(/^\/c\/([A-Za-z0-9_.\-]+)/);
  if (customMatch) {
    return { kind: 'username', value: customMatch[1] };
  }

  return null;
}

// ── YouTube Data API helpers ──────────────────────────────────────────────────
async function fetchChannel(parsed, apiKey) {
  const params = new URLSearchParams({
    part: 'snippet,brandingSettings,contentDetails,statistics',
    key:  apiKey,
  });
  if (parsed.kind === 'handle')        params.set('forHandle',   parsed.value);
  else if (parsed.kind === 'id')       params.set('id',          parsed.value);
  else if (parsed.kind === 'username') params.set('forUsername', parsed.value);

  const res = await fetch(`${YT_BASE}/channels?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    const err  = new Error(`channels.list ${res.status}`);
    err.status = res.status;
    err.body   = body.slice(0, 400);
    throw err;
  }
  const json = await res.json();
  return json.items?.[0] || null;
}

async function fetchUploads(uploadsPlaylistId, apiKey) {
  const params = new URLSearchParams({
    part:       'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: '10',
    key:        apiKey,
  });
  const res = await fetch(`${YT_BASE}/playlistItems?${params.toString()}`);
  if (!res.ok) {
    const err  = new Error(`playlistItems.list ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return json.items || [];
}

// ── Supabase shared-cache helpers ─────────────────────────────────────────────
async function readSharedCache(supabase, channelId) {
  if (!supabase || !channelId) return null;
  const { data, error } = await supabase
    .from('shared_brand_kits')
    .select('payload, updated_at')
    .eq('channel_id', channelId)
    .maybeSingle();
  if (error) {
    console.warn('[BRAND-KIT] shared cache read failed:', error.message);
    return null;
  }
  if (!data) return null;
  const ageMs = Date.now() - new Date(data.updated_at).getTime();
  if (ageMs > SHARED_TTL_MS) return null;
  return data.payload;
}

async function writeSharedCache(supabase, channelId, payload) {
  if (!supabase || !channelId) return;
  const { error } = await supabase
    .from('shared_brand_kits')
    .upsert({ channel_id: channelId, payload }, { onConflict: 'channel_id' });
  if (error) {
    console.warn('[BRAND-KIT] shared cache write failed:', error.message);
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────
// `supabase` is the service-role client created in index.js; null when
// SUPABASE_URL / SUPABASE_SERVICE_KEY aren't configured. Routes degrade
// gracefully — in-memory cache still works.
module.exports = function makeBrandKitRoutes(supabase) {
  const router = express.Router();

  // POST /channel-by-url
  // Body: { input: string }
  router.post('/channel-by-url', async (req, res) => {
    const apiKey =
      process.env.YOUTUBE_DATA_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error: 'YouTube Data API key not configured on server',
        code:  'NOT_CONFIGURED',
      });
    }

    const raw = (req.body?.input || '').toString();
    const parsed = parseChannelInput(raw);
    if (!parsed) {
      return res.status(400).json({
        error: 'Could not parse a channel URL, @handle, or channel id from the input',
        code:  'BAD_INPUT',
      });
    }

    const cacheKey = `${parsed.kind}:${parsed.value}`;
    const cached   = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < MEM_TTL_MS) {
      return res.json({ ...cached.data, fromCache: true });
    }

    // L2: shared Supabase cache. We can only key by channelId, so kind=id
    // hits L2 directly; @handle / username have to resolve through the
    // channels.list call first to learn the id, then re-check L2 below.
    if (parsed.kind === 'id') {
      const shared = await readSharedCache(supabase, parsed.value);
      if (shared) {
        cache.set(cacheKey, { data: shared, ts: Date.now() });
        return res.json({ ...shared, fromCache: true });
      }
    }

    try {
      const channel = await fetchChannel(parsed, apiKey);
      if (!channel) {
        return res.status(404).json({
          error: 'No channel found — try the @handle from the channel page',
          code:  'NOT_FOUND',
        });
      }

      // L2 second-chance: now that we know the canonical channelId, check
      // the shared cache before paying for color extraction. Skips the
      // playlistItems.list call too (saves 1 quota unit per warm hit).
      if (parsed.kind !== 'id') {
        const shared = await readSharedCache(supabase, channel.id);
        if (shared) {
          cache.set(cacheKey, { data: shared, ts: Date.now() });
          return res.json({ ...shared, fromCache: true });
        }
      }

      const uploadsPlaylistId =
        channel.contentDetails?.relatedPlaylists?.uploads || null;

      let recentThumbnails = [];
      if (uploadsPlaylistId) {
        try {
          const items = await fetchUploads(uploadsPlaylistId, apiKey);
          recentThumbnails = items
            .map((it) => {
              const sn = it.snippet || {};
              const tn = sn.thumbnails || {};
              return {
                videoId:     it.contentDetails?.videoId || sn.resourceId?.videoId || null,
                title:       sn.title || '',
                publishedAt: sn.publishedAt || null,
                url:         tn.maxres?.url || tn.standard?.url || tn.high?.url || tn.medium?.url || tn.default?.url || null,
              };
            })
            .filter((v) => v.videoId && v.url);
        } catch (uploadsErr) {
          console.warn('[BRAND-KIT] uploads fetch failed:', uploadsErr.message);
          // Non-fatal — channel still resolves
        }
      }

      const sn = channel.snippet || {};
      const bs = channel.brandingSettings || {};
      const st = channel.statistics || {};
      const av = sn.thumbnails || {};

      const avatarUrl = av.high?.url || av.medium?.url || av.default?.url || null;

      // ── Color extraction (server-side k-means via sharp) ────────────────
      let palette = [];
      let primaryAccent = null;
      try {
        const result = await extractColors({
          avatarUrl,
          thumbnails: recentThumbnails.map((t) => t.url),
        });
        palette = result.palette;
        primaryAccent = result.primaryAccent;
      } catch (extractErr) {
        console.warn('[BRAND-KIT] color extraction failed:', extractErr.message);
        // Non-fatal — return the kit without colors so the user sees a
        // partial result rather than a hard error.
      }

      const data = {
        channelId:        channel.id,
        channelTitle:     sn.title || '',
        customUrl:        sn.customUrl || (parsed.kind === 'handle' ? parsed.value : null),
        description:      sn.description || '',
        avatarUrl,
        bannerUrl:        bs.image?.bannerExternalUrl || null,
        country:          sn.country || null,
        subscriberCount:  parseInt(st.subscriberCount || '0', 10),
        videoCount:       parseInt(st.videoCount || '0', 10),
        viewCount:        parseInt(st.viewCount || '0', 10),
        recentThumbnails,
        palette,
        primaryAccent,
      };

      cache.set(cacheKey, { data, ts: Date.now() });
      // Fire-and-forget L2 write; don't block the response.
      void writeSharedCache(supabase, channel.id, data);
      return res.json(data);
    } catch (err) {
      const status  = err.status || 500;
      const isQuota = status === 403 && /quota/i.test(err.body || '');
      console.error('[BRAND-KIT] /channel-by-url error:', err.message, err.body || '');
      if (isQuota) {
        return res.status(429).json({
          error: "YouTube's daily quota is spent — try again tomorrow",
          code:  'QUOTA_EXHAUSTED',
        });
      }
      return res.status(status >= 400 && status < 600 ? status : 502).json({
        error: 'YouTube lookup failed',
        code:  'UPSTREAM_ERROR',
      });
    }
  });

  return router;
};

// Test-only export — used by the URL-parser unit tests.
module.exports._parseChannelInput = parseChannelInput;
