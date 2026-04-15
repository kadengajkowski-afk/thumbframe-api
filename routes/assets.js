'use strict';

const express = require('express');

// ── Factory ────────────────────────────────────────────────────────────────────
module.exports = function (supabase, flexAuth) {
  const router = express.Router();

  // GET /photos — search or browse Unsplash photos
  router.get('/photos', async (req, res) => {
    try {
      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!accessKey) {
        return res.json({
          error: 'unsplash_not_configured',
          photos: [],
          total: 0,
          total_pages: 0,
        });
      }

      const { q, category, page = 1, per_page = 20 } = req.query;
      const safePerPage = Math.min(Number(per_page) || 20, 30); // Unsplash max is 30
      const safePage = Math.max(Number(page) || 1, 1);

      let apiUrl;
      let searchQuery = q || category || null;

      if (searchQuery) {
        // Use search endpoint when a query is provided
        const params = new URLSearchParams({
          query: searchQuery,
          page: safePage,
          per_page: safePerPage,
          orientation: 'landscape', // prefer landscape for 16:9 thumbnails
        });
        apiUrl = `https://api.unsplash.com/search/photos?${params}`;
      } else {
        // Browse curated photos when no query
        const params = new URLSearchParams({
          page: safePage,
          per_page: safePerPage,
          order_by: 'popular',
        });
        apiUrl = `https://api.unsplash.com/photos?${params}`;
      }

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      });

      if (!response.ok) {
        console.error('[assets] Unsplash API error:', response.status);
        return res.json({ photos: [], total: 0, total_pages: 0, error: 'fetch_failed' });
      }

      const data = await response.json();

      // Normalize both search results and curated list to the same shape
      const rawPhotos = searchQuery ? (data.results || []) : (Array.isArray(data) ? data : []);
      const total       = searchQuery ? (data.total       || rawPhotos.length) : rawPhotos.length;
      const total_pages = searchQuery ? (data.total_pages || 1)               : 1;

      const photos = rawPhotos.map((photo) => ({
        id:              photo.id,
        urls:            { regular: photo.urls?.regular, thumb: photo.urls?.thumb },
        alt_description: photo.alt_description || photo.description || '',
        user: {
          name:  photo.user?.name || '',
          links: { html: photo.user?.links?.html || '' },
        },
        width:  photo.width,
        height: photo.height,
      }));

      return res.json({ photos, total, total_pages });
    } catch (err) {
      console.error('[assets] GET /photos error:', err.message);
      return res.json({ photos: [], total: 0, total_pages: 0, error: 'fetch_failed' });
    }
  });

  // POST /photos/download — trigger Unsplash download event (TOS requirement)
  router.post('/photos/download', flexAuth, async (req, res) => {
    try {
      const { downloadUrl } = req.body;
      if (!downloadUrl || typeof downloadUrl !== 'string') {
        return res.status(400).json({ error: 'missing_download_url' });
      }

      const accessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (accessKey) {
        // Fire-and-forget — satisfies Unsplash TOS, must not block the response
        fetch(downloadUrl, {
          headers: { Authorization: `Client-ID ${accessKey}` },
        }).catch((err) => {
          console.error('[assets] Unsplash download trigger failed (non-fatal):', err.message);
        });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[assets] POST /photos/download error:', err.message);
      return res.status(500).json({ error: 'download_trigger_failed', message: err.message });
    }
  });

  // GET /png-library — list PNG assets from Supabase Storage bucket 'assets'
  router.get('/png-library', async (req, res) => {
    try {
      if (!supabase) {
        return res.json({ assets: [] });
      }

      const { data, error } = await supabase.storage.from('assets').list('', {
        limit: 200,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

      if (error) {
        console.error('[assets] GET /png-library Supabase error:', error.message);
        return res.json({ assets: [] });
      }

      // Return placeholder — assets will populate once PNGs are uploaded to the bucket
      const assets = (data || [])
        .filter((item) => item.name && item.name.toLowerCase().endsWith('.png'))
        .map((item) => {
          const { data: urlData } = supabase.storage
            .from('assets')
            .getPublicUrl(item.name);
          return {
            name:       item.name,
            url:        urlData?.publicUrl || null,
            created_at: item.created_at || null,
          };
        });

      return res.json({ assets });
    } catch (err) {
      console.error('[assets] GET /png-library error:', err.message);
      return res.json({ assets: [] });
    }
  });

  // GET /my-uploads — list the authenticated user's uploaded images
  router.get('/my-uploads', flexAuth, async (req, res) => {
    try {
      if (!supabase) {
        return res.json({ uploads: [] });
      }

      const userId = req.user?.id || req.user?.sub;
      if (!userId) {
        return res.json({ uploads: [] });
      }

      const { data, error } = await supabase.storage
        .from('user-uploads')
        .list(`${userId}/`, {
          limit: 200,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        console.error('[assets] GET /my-uploads Supabase error:', error.message);
        return res.json({ uploads: [] });
      }

      const uploads = (data || []).map((item) => {
        const { data: urlData } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(`${userId}/${item.name}`);
        return {
          name:       item.name,
          url:        urlData?.publicUrl || null,
          created_at: item.created_at || null,
        };
      });

      return res.json({ uploads });
    } catch (err) {
      console.error('[assets] GET /my-uploads error:', err.message);
      return res.json({ uploads: [] });
    }
  });

  return router;
};
