import { getConnectionFeed } from '../lib/linkedinVoyager.js';
import { ScrapeJob } from '../models/ScrapeJob.js';

export async function fetchConnectionPosts({ cookie, keyword = '', limit = 25 }) {
  if (!cookie) throw new Error('LinkedIn session cookie required');

  const job = await ScrapeJob.create({
    type: 'connection-posts',
    keywords: keyword ? [keyword] : [],
  });

  (async () => {
    try {
      await ScrapeJob.update(job.id, { status: 'running' });

      console.log(`[connection-posts:${job.id}] fetching via LinkedIn Voyager API, limit=${limit}`);
      const results = await getConnectionFeed(cookie, limit, keyword);
      console.log(`[connection-posts:${job.id}] got ${results.length} posts`);

      await ScrapeJob.update(job.id, { status: 'succeeded', results });
    } catch (err) {
      console.error(`[connection-posts:${job.id}] failed — ${err.message}`);
      await ScrapeJob.update(job.id, { status: 'failed', error: err.message });
    }
  })();

  return job;
}
