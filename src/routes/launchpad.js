import express from 'express';
import { config } from '../config.js';
import {
  ensureLinkedInCustomField,
  findContactByLinkedIn,
  createContact,
  addTask,
  addNote,
  normalizeLinkedInUrl,
} from '../lib/launchpadClient.js';
import { enrichProfile } from '../services/enrichment.js';
import { mapWithConcurrency } from '../lib/concurrency.js';

const router = express.Router();

router.post('/push', async (req, res) => {
  if (!config.launchpad.pit || !config.launchpad.locationId) {
    return res.status(500).json({
      error: 'Launchpad credentials not configured in .env.local',
    });
  }

  const posts = Array.isArray(req.body?.posts) ? req.body.posts : [];
  const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
  if (posts.length === 0) {
    return res.status(400).json({ error: 'No posts provided' });
  }

  console.log(`[launchpad] push requested: ${posts.length} post(s)`);

  let field;
  try {
    field = await ensureLinkedInCustomField();
  } catch (err) {
    console.error('[launchpad] custom field setup failed', err);
    return res.status(500).json({
      error: 'Failed to set up custom field',
      message: err.message,
    });
  }

  const summary = {
    total: posts.length,
    created: 0,
    existing: 0,
    enriched: 0,
    failed: 0,
    errors: [],
  };

  async function processPost(post) {
    const enrichment = await enrichProfile(post);
    if (enrichment?.email) summary.enriched++;

    let contact = await findContactByLinkedIn(normalizeLinkedInUrl(post.authorProfileUrl), field);
    const isNew = !contact;
    if (!contact) {
      contact = await createContact({ post, enrichment, field, tags });
    }

    const contactId = contact.id || contact._id || contact.contactId;
    if (!contactId) throw new Error('No contact ID returned from Launchpad');

    await Promise.all([
      addTask(contactId, post),
      addNote(contactId, post, enrichment),
    ]);

    if (isNew) summary.created++;
    else summary.existing++;

    console.log(
      `[launchpad] ✓ ${isNew ? 'created' : 'existing'} ${post.authorName} (${contactId})${enrichment?.email ? ' [enriched]' : ''}`,
    );
  }

  const outcomes = await mapWithConcurrency(
    posts,
    config.enrichment.concurrency,
    processPost,
  );
  outcomes.forEach((r, i) => {
    if (!r.ok) {
      summary.failed++;
      summary.errors.push({
        author: posts[i]?.authorName,
        error: r.error.message,
      });
      console.error(`[launchpad] ✗ ${posts[i]?.authorName}: ${r.error.message}`);
    }
  });

  console.log(
    `[launchpad] done: ${summary.created} new, ${summary.existing} existing, ${summary.enriched} enriched, ${summary.failed} failed`,
  );
  res.json(summary);
});

export default router;
