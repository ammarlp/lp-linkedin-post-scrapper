import { getConnections } from '../lib/linkedinVoyager.js';
import { ScrapeJob } from '../models/ScrapeJob.js';

export async function fetchConnections({ cookie, limit = 100 }) {
  if (!cookie) throw new Error('LinkedIn session cookie required');

  const job = await ScrapeJob.create({ type: 'connections', keywords: [] });

  (async () => {
    try {
      await ScrapeJob.update(job.id, { status: 'running' });

      console.log(`[connections:${job.id}] fetching via LinkedIn Voyager API, limit=${limit}`);
      const results = await getConnections(cookie, limit);
      console.log(`[connections:${job.id}] got ${results.length} connections`);

      await ScrapeJob.update(job.id, { status: 'succeeded', results });
    } catch (err) {
      console.error(`[connections:${job.id}] failed — ${err.message}`);
      await ScrapeJob.update(job.id, { status: 'failed', error: err.message });
    }
  })();

  return job;
}
