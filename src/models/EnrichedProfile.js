import { config } from '../config.js';
import { isConnected, getMongoose } from '../lib/db.js';

const memCache = new Map();
let Model = null;

function ensureModel() {
  if (Model || !isConnected()) return Model;
  const mongoose = getMongoose();
  const schema = new mongoose.Schema(
    {
      linkedinUrl: { type: String, required: true, unique: true, index: true },
      authorName: String,
      enrichment: mongoose.Schema.Types.Mixed,
    },
    { timestamps: true },
  );
  Model = mongoose.models.EnrichedProfile || mongoose.model('EnrichedProfile', schema);
  return Model;
}

function isFresh(updatedAt) {
  const ttlMs = config.enrichment.cacheTtlDays * 24 * 3600 * 1000;
  return Date.now() - new Date(updatedAt).getTime() < ttlMs;
}

export const EnrichedProfile = {
  async findByLinkedIn(url) {
    if (!url) return null;
    const M = ensureModel();
    if (M) {
      const doc = await M.findOne({ linkedinUrl: url }).lean();
      if (!doc || !isFresh(doc.updatedAt)) return null;
      return doc;
    }
    const cached = memCache.get(url);
    if (!cached || !isFresh(cached.updatedAt)) return null;
    return cached;
  },

  async upsert({ linkedinUrl, authorName, enrichment }) {
    if (!linkedinUrl) return;
    const M = ensureModel();
    if (M) {
      await M.updateOne(
        { linkedinUrl },
        { $set: { authorName, enrichment } },
        { upsert: true },
      );
      return;
    }
    memCache.set(linkedinUrl, {
      linkedinUrl,
      authorName,
      enrichment,
      updatedAt: new Date(),
    });
  },
};
