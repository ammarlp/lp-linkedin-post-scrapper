import { config } from '../config.js';

let mongooseRef = null;
let connected = false;

export async function connectMongo() {
  if (!config.mongo.uri) return false;
  try {
    const mod = await import('mongoose');
    mongooseRef = mod.default || mod;
    await mongooseRef.connect(config.mongo.uri);
    connected = true;
    console.log('[db] connected to MongoDB');
    return true;
  } catch (err) {
    console.warn(`[db] mongo unavailable (${err.message}) — using in-memory stores`);
    mongooseRef = null;
    connected = false;
    return false;
  }
}

export function isConnected() {
  return connected;
}

export function getMongoose() {
  return mongooseRef;
}
