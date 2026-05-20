import { config } from '../config.js';
import {
  startActorRun,
  getRun,
  getDatasetItems,
} from '../lib/apifyClient.js';
import { ScrapeJob } from '../models/ScrapeJob.js';

const TERMINAL_FAILURE = new Set(['FAILED', 'TIMED-OUT', 'ABORTED']);

const pick = (obj, ...keys) => {
  for (const k of keys) {
    if (obj?.[k] != null && obj[k] !== '') return obj[k];
  }
  return '';
};

function normalizeReactor(item) {
  // datadoping~linkedin-post-reactions-scraper-no-cookie exact output shape:
  // { reaction_type, reactor: { name, headline, profile_pictures: { large, medium } },
  //   reactor_name, reactor_profile_url, reactor_profile_picture }
  const reactor = item.reactor ?? {};
  return {
    name: pick(reactor, 'name') || pick(item, 'reactor_name'),
    headline: pick(reactor, 'headline'),
    profileUrl: pick(item, 'reactor_profile_url') || pick(reactor, 'profileUrl', 'url'),
    picture: pick(item, 'reactor_profile_picture') || reactor.profile_pictures?.large || reactor.profile_pictures?.medium || '',
    reactionType: pick(item, 'reaction_type', 'reactionType') || 'LIKE',
  };
}

function normalizeCommenter(item) {
  // datadoping~linkedin-post-comments-scraper nests author info under item.author
  const author = item.author ?? {};
  return {
    name: pick(author, 'name', 'fullName') || pick(item, 'commenterName', 'authorName', 'name', 'actorName'),
    headline: pick(author, 'headline', 'occupation') || pick(item, 'commenterHeadline', 'authorHeadline', 'headline'),
    profileUrl: pick(author, 'profileUrl', 'linkedinUrl', 'url') || pick(item, 'commenterProfileUrl', 'authorProfileUrl', 'profileUrl', 'linkedinUrl'),
    picture: pick(author, 'profilePicture', 'picture', 'pictureUrl') || pick(item, 'commenterPicture', 'profilePicture', 'pictureUrl'),
    reactionType: 'COMMENT',
    commentText: pick(item, 'text', 'commentText', 'comment', 'message', 'content'),
    postedAt: pick(item, 'timestamp', 'postedAt', 'createdAt', 'commentedAt', 'date'),
    likes: parseInt(item.likesCount ?? item.numLikes ?? item.likes ?? item.reactionsCount, 10) || 0,
    replies: parseInt(item.repliesCount ?? item.replies ?? 0, 10) || 0,
  };
}

function matchesKeywords(text, keywords) {
  if (!keywords?.length) return true;
  const lowered = (text || '').toLowerCase();
  return keywords.some((k) => lowered.includes(k.toLowerCase()));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForRun(runId) {
  const started = Date.now();
  while (Date.now() - started < config.scrape.maxWaitMs) {
    const run = await getRun(runId);
    if (run.status === 'SUCCEEDED') return run;
    if (TERMINAL_FAILURE.has(run.status)) {
      throw new Error(`Apify run ${run.status}`);
    }
    await wait(config.scrape.pollIntervalMs);
  }
  throw new Error('Apify run exceeded maxWaitMs');
}

async function executeJob({ jobId, actorId, input, normalize, filter, limit }) {
  try {
    await ScrapeJob.update(jobId, { status: 'running' });
    const run = await startActorRun(actorId, input);
    await ScrapeJob.update(jobId, { apifyRunId: run.id });

    const finished = await waitForRun(run.id);
    const items = await getDatasetItems(finished.defaultDatasetId);

    const normalized = (Array.isArray(items) ? items : []).map(normalize);
    const filtered = filter ? normalized.filter(filter) : normalized;
    const results = limit ? filtered.slice(0, limit) : filtered;

    await ScrapeJob.update(jobId, {
      status: 'succeeded',
      datasetId: finished.defaultDatasetId,
      results,
    });
    console.log(`[scrape:${jobId}] succeeded — ${results.length} profiles`);
  } catch (err) {
    console.error(`[scrape:${jobId}] failed — ${err.message}`);
    await ScrapeJob.update(jobId, { status: 'failed', error: err.message });
  }
}

export async function scrapePostReactions({ postUrl, limit = 100 }) {
  if (!postUrl) throw new Error('postUrl required');
  const job = await ScrapeJob.create({ type: 'reactions', postUrl });

  executeJob({
    jobId: job.id,
    actorId: config.apify.reactionsActor,
    input: { post_urls: [postUrl], reaction_type: 'ALL', max_reactions: Math.max(10, limit) },
    normalize: normalizeReactor,
    limit,
  });

  return job;
}

export async function scrapePostLikes({ postUrl, limit = 100 }) {
  if (!postUrl) throw new Error('postUrl required');
  const job = await ScrapeJob.create({ type: 'likes', postUrl });

  executeJob({
    jobId: job.id,
    actorId: config.apify.reactionsActor,
    input: { post_urls: [postUrl], reaction_type: 'LIKE', max_reactions: Math.max(10, limit) },
    normalize: normalizeReactor,
    limit,
  });

  return job;
}

export async function scrapePostComments({
  postUrl,
  keywords = [],
  limit = 200,
}) {
  if (!postUrl) throw new Error('postUrl required');
  const normalizedKeywords = keywords
    .map((k) => String(k).trim())
    .filter(Boolean);

  const job = await ScrapeJob.create({
    type: 'comments',
    postUrl,
    keywords: normalizedKeywords,
  });

  executeJob({
    jobId: job.id,
    actorId: config.apify.commentsActor,
    input: { posts: [postUrl], maxComments: limit },
    normalize: normalizeCommenter,
    filter: (c) => matchesKeywords(c.commentText, normalizedKeywords),
    limit,
  });

  return job;
}

export async function scrapePostCommentsByKeyword({
  postUrl,
  keywords = [],
  limit = 200,
}) {
  if (!postUrl) throw new Error('postUrl required');
  const normalizedKeywords = keywords
    .map((k) => String(k).trim())
    .filter(Boolean);

  const job = await ScrapeJob.create({
    type: 'keyword-comments',
    postUrl,
    keywords: normalizedKeywords,
  });

  executeJob({
    jobId: job.id,
    actorId: config.apify.commentsActor,
    input: { posts: [postUrl], maxComments: limit },
    normalize: normalizeCommenter,
    filter: (c) => matchesKeywords(c.commentText, normalizedKeywords),
    limit,
  });

  return job;
}
