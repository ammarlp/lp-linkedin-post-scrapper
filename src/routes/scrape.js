import express from 'express';
import {
  scrapePostReactions,
  scrapePostComments,
  scrapePostLikes,
  scrapePostCommentsByKeyword,
} from '../services/scrapers.js';
import { ScrapeJob } from '../models/ScrapeJob.js';

const router = express.Router();

function parseKeywords(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

router.post('/reactions', async (req, res) => {
  const { postUrl, limit } = req.body ?? {};
  try {
    const job = await scrapePostReactions({
      postUrl,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(202).json({ jobId: job.id, status: job.status, type: 'reactions' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/likes', async (req, res) => {
  const { postUrl, limit } = req.body ?? {};
  try {
    const job = await scrapePostLikes({
      postUrl,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(202).json({ jobId: job.id, status: job.status, type: 'likes' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/comments', async (req, res) => {
  const { postUrl, keywords, limit } = req.body ?? {};
  try {
    const job = await scrapePostComments({
      postUrl,
      keywords: parseKeywords(keywords),
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(202).json({ jobId: job.id, status: job.status, type: 'comments' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/comments/keywords', async (req, res) => {
  const { postUrl, keywords, limit } = req.body ?? {};
  try {
    const job = await scrapePostCommentsByKeyword({
      postUrl,
      keywords: parseKeywords(keywords),
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.status(202).json({ jobId: job.id, status: job.status, type: 'keyword-comments' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status/:jobId', async (req, res) => {
  const job = await ScrapeJob.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

export default router;
