import crypto from 'node:crypto';
import { isConnected, getMongoose } from '../lib/db.js';

const memStore = new Map();
let Model = null;

function ensureModel() {
  if (Model || !isConnected()) return Model;
  const mongoose = getMongoose();
  const schema = new mongoose.Schema(
    {
      _id: { type: String },
      type: { type: String, required: true },
      postUrl: String,
      keywords: [String],
      status: { type: String, default: 'pending' },
      apifyRunId: String,
      datasetId: String,
      results: { type: [mongoose.Schema.Types.Mixed], default: [] },
      error: String,
    },
    { timestamps: true, _id: false },
  );
  Model = mongoose.models.ScrapeJob || mongoose.model('ScrapeJob', schema);
  return Model;
}

function toPlain(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  obj.id = obj.id || obj._id;
  return obj;
}

export const ScrapeJob = {
  async create(data) {
    const id = crypto.randomUUID();
    const now = new Date();
    const base = {
      id,
      type: data.type,
      postUrl: data.postUrl || '',
      keywords: data.keywords || [],
      status: 'pending',
      results: [],
      createdAt: now,
      updatedAt: now,
    };

    const M = ensureModel();
    if (M) {
      await M.create({ _id: id, ...base });
      return base;
    }
    memStore.set(id, base);
    return base;
  },

  async update(id, patch) {
    const M = ensureModel();
    if (M) {
      await M.updateOne({ _id: id }, { $set: patch });
      return;
    }
    const existing = memStore.get(id);
    if (existing) memStore.set(id, { ...existing, ...patch, updatedAt: new Date() });
  },

  async get(id) {
    const M = ensureModel();
    if (M) {
      const doc = await M.findById(id).lean();
      return toPlain(doc);
    }
    return memStore.get(id) || null;
  },
};
