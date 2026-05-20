import express from 'express';
import { config } from '../config.js';
import { runActorSync } from '../lib/apifyClient.js';

const router = express.Router();

function buildLinkedInSearchUrl(keyword, datePosted, sortBy) {
  const params = new URLSearchParams();
  params.set('keywords', keyword);
  if (datePosted && datePosted !== 'any') {
    params.set('datePosted', `"${datePosted}"`);
  }
  if (sortBy && sortBy !== 'relevance') {
    params.set('sortBy', `"${sortBy}"`);
  }
  params.set('origin', 'FACETED_SEARCH');
  return `https://www.linkedin.com/search/results/content/?${params.toString()}`;
}

router.post('/', async (req, res) => {
  const {
    keyword,
    limit = 10,
    datePosted = 'any',
    sortBy = 'relevance',
  } = req.body ?? {};

  if (!keyword || typeof keyword !== 'string') {
    return res.status(400).json({ error: 'keyword is required' });
  }

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const searchUrl = buildLinkedInSearchUrl(keyword, datePosted, sortBy);

  console.log(
    `[search] keyword="${keyword}" limit=${safeLimit} datePosted=${datePosted}`,
  );

  try {
    const items = await runActorSync(config.apify.postSearchActor, {
      urls: [searchUrl],
      limitPerSource: safeLimit,
      deepScrape: true,
    });
    if (Array.isArray(items) && items.length > 0) {
      console.log('[search] payload keys:', Object.keys(items[0]));
    }
    console.log(
      `[search] got ${Array.isArray(items) ? items.length : 0} posts`,
    );
    res.json({ items, searchUrl });
  } catch (err) {
    console.error('[search] failed', err);
    res.status(502).json({
      error: 'Failed to reach Apify',
      message: String(err.message || err),
    });
  }
});

export default router;
