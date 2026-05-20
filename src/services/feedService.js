import { config } from '../config.js';
import { startActorRun, getRun, getDatasetItems } from '../lib/apifyClient.js';
import { ScrapeJob } from '../models/ScrapeJob.js';
import { parseCookies } from '../lib/cookieHelper.js';

const TERMINAL_FAILURE = new Set(['FAILED', 'TIMED-OUT', 'ABORTED']);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const pick = (obj, ...keys) => {
  for (const k of keys) {
    if (obj?.[k] != null && obj[k] !== '') return obj[k];
  }
  return '';
};

function normalizeFeedPost(item) {
  // data_link_miner~linkedin-network-scraper output shape
  const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ')
    || pick(item, 'name', 'fullName', 'authorName');
  return {
    authorName: fullName,
    authorHeadline: pick(item, 'headline', 'authorHeadline'),
    authorProfileUrl: pick(item, 'url', 'profileUrl', 'authorProfileUrl'),
    authorProfilePicture: pick(item, 'picture', 'profilePicture', 'authorPicture'),
    authorType: 'Person',
    url: pick(item, 'url', 'profileUrl'),
    text: pick(item, 'connection_date', 'formated_connection_date', 'text', 'postText'),
    numLikes: 0,
    numComments: 0,
    numShares: 0,
    postedAtISO: pick(item, 'formated_connection_date', 'postedAtISO', 'postedAt'),
    timeSincePosted: pick(item, 'connection_date', 'timeSincePosted'),
    isRepost: false,
  };
}

async function waitForRun(runId) {
  const started = Date.now();
  while (Date.now() - started < config.scrape.maxWaitMs) {
    const run = await getRun(runId);
    if (run.status === 'SUCCEEDED') return run;
    if (TERMINAL_FAILURE.has(run.status)) throw new Error(`Apify run ${run.status}`);
    await wait(config.scrape.pollIntervalMs);
  }
  throw new Error('Feed search exceeded maxWaitMs');
}

export async function searchConnectionsFeed({ cookie, keyword, limit = 25, datePosted = 'any' }) {
  if (!cookie) throw new Error('LinkedIn session cookie required');

  const job = await ScrapeJob.create({
    type: 'feed-search',
    keywords: keyword ? [keyword] : [],
  });

  (async () => {
    try {
      await ScrapeJob.update(job.id, { status: 'running' });

      const input = {
        cookies: parseCookies(cookie),
        maxResults: limit,
      };

      const run = await startActorRun(config.apify.feedActor, input);
      await ScrapeJob.update(job.id, { apifyRunId: run.id });

      const finished = await waitForRun(run.id);
      const items = await getDatasetItems(finished.defaultDatasetId);

      const results = (Array.isArray(items) ? items : [])
        .map(normalizeFeedPost)
        .slice(0, limit);

      await ScrapeJob.update(job.id, { status: 'succeeded', datasetId: finished.defaultDatasetId, results });
      console.log(`[feed:${job.id}] succeeded — ${results.length} posts`);
    } catch (err) {
      console.error(`[feed:${job.id}] failed — ${err.message}`);
      await ScrapeJob.update(job.id, { status: 'failed', error: err.message });
    }
  })();

  return job;
}
