import express from 'express';
import { config } from '../config.js';
import { searchConnectionsFeed } from '../services/feedService.js';
import { fetchConnections } from '../services/connectionsService.js';
import { fetchConnectionPosts } from '../services/connectionPostsService.js';
import { ScrapeJob } from '../models/ScrapeJob.js';
import { startActorRun, getRun, getDatasetItems } from '../lib/apifyClient.js';

const router = express.Router();

/* ─── Connections ─── */

router.post('/connections', async (req, res) => {
  const { cookie, limit } = req.body ?? {};
  if (!cookie) return res.status(400).json({ error: 'Session cookie (li_at) required' });

  try {
    const job = await fetchConnections({
      cookie,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    res.status(202).json({ jobId: job.id, status: job.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/connections-status/:jobId', async (req, res) => {
  const job = await ScrapeJob.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/* ─── Connection Posts (Feed) ─── */

router.post('/posts', async (req, res) => {
  const { cookie, keyword, limit } = req.body ?? {};
  if (!cookie) return res.status(400).json({ error: 'Session cookie (li_at) required' });

  try {
    const job = await fetchConnectionPosts({
      cookie,
      keyword: keyword || '',
      limit: limit ? parseInt(limit, 10) : 25,
    });
    res.status(202).json({ jobId: job.id, status: job.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/posts-status/:jobId', async (req, res) => {
  const job = await ScrapeJob.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/* ─── Messages ─── */

router.post('/messages', async (req, res) => {
  if (!config.apify.messagesActor) {
    return res.status(501).json({
      error: 'Messages scraping is not configured. Set APIFY_MESSAGES_ACTOR in .env.local.',
    });
  }

  const { cookie, limit } = req.body ?? {};
  if (!cookie) return res.status(400).json({ error: 'Session cookie (li_at) required' });

  const job = await ScrapeJob.create({ type: 'messages', keywords: [] });

  (async () => {
    const TERMINAL = new Set(['FAILED', 'TIMED-OUT', 'ABORTED']);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      await ScrapeJob.update(job.id, { status: 'running' });
      const run = await startActorRun(config.apify.messagesActor, {
        cookies: cookie,
        maxResults: limit ? parseInt(limit, 10) : 50,
      });
      await ScrapeJob.update(job.id, { apifyRunId: run.id });

      const started = Date.now();
      let finished;
      while (Date.now() - started < config.scrape.maxWaitMs) {
        const r = await getRun(run.id);
        if (r.status === 'SUCCEEDED') { finished = r; break; }
        if (TERMINAL.has(r.status)) throw new Error(`Apify run ${r.status}`);
        await wait(config.scrape.pollIntervalMs);
      }
      if (!finished) throw new Error('Messages fetch exceeded maxWaitMs');

      const items = await getDatasetItems(finished.defaultDatasetId);
      const results = (Array.isArray(items) ? items : []).map((m) => ({
        conversationId: m.conversationId || m.threadId || m.id || '',
        participantName: m.participantName || m.name || m.senderName || '',
        participantHeadline: m.participantHeadline || m.headline || '',
        participantProfileUrl: m.participantUrl || m.profileUrl || m.url || '',
        participantPicture: m.participantPicture || m.picture || '',
        lastMessage: m.lastMessage || m.text || m.content || '',
        lastMessageAt: m.lastMessageAt || m.timestamp || m.date || '',
        unreadCount: parseInt(m.unreadCount ?? 0) || 0,
      }));

      await ScrapeJob.update(job.id, { status: 'succeeded', datasetId: finished.defaultDatasetId, results });
      console.log(`[messages:${job.id}] succeeded — ${results.length} conversations`);
    } catch (err) {
      console.error(`[messages:${job.id}] failed — ${err.message}`);
      await ScrapeJob.update(job.id, { status: 'failed', error: err.message });
    }
  })();

  res.status(202).json({ jobId: job.id, status: job.status });
});

router.get('/messages-status/:jobId', async (req, res) => {
  const job = await ScrapeJob.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

/* ─── Legacy feed-search (kept for backwards compat) ─── */

router.post('/feed-search', async (req, res) => {
  const { cookie, keyword, limit, datePosted } = req.body ?? {};
  if (!cookie) return res.status(400).json({ error: 'Session cookie (li_at) required' });

  try {
    const job = await searchConnectionsFeed({
      cookie,
      keyword: keyword || '',
      limit: limit ? parseInt(limit, 10) : 25,
      datePosted: datePosted || 'any',
    });
    res.status(202).json({ jobId: job.id, status: job.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/feed-status/:jobId', async (req, res) => {
  const job = await ScrapeJob.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

export default router;
