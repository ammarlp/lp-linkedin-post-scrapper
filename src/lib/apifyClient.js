import { config } from '../config.js';
import { fetchJson } from './httpClient.js';

const BASE = 'https://api.apify.com/v2';

const tokenParam = () => `token=${config.apify.token}`;

function jsonBody(body) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function runActorSync(actorId, input) {
  const url = `${BASE}/acts/${actorId}/run-sync-get-dataset-items?${tokenParam()}`;
  return fetchJson(url, jsonBody(input));
}

export async function startActorRun(actorId, input) {
  const url = `${BASE}/acts/${actorId}/runs?${tokenParam()}`;
  const res = await fetchJson(url, jsonBody(input));
  return res.data;
}

export async function getRun(runId) {
  const url = `${BASE}/actor-runs/${runId}?${tokenParam()}`;
  const res = await fetchJson(url);
  return res.data;
}

export async function getKeyValueStoreKeys(storeId) {
  const url = `${BASE}/key-value-stores/${storeId}/keys?${tokenParam()}`;
  const data = await fetchJson(url);
  return (data.data?.items || []).map((i) => i.key);
}

export async function getKeyValueStoreRecord(storeId, key) {
  const url = `${BASE}/key-value-stores/${storeId}/records/${key}?${tokenParam()}`;
  return fetchJson(url);
}

export async function getDatasetItems(datasetId) {
  const url = `${BASE}/datasets/${datasetId}/items?${tokenParam()}&clean=true`;
  const data = await fetchJson(url);
  // Apify wraps items in { items: [...] } for some dataset endpoints
  if (data && !Array.isArray(data) && Array.isArray(data.items)) {
    console.log(`[apify] getDatasetItems: unwrapping .items array (${data.items.length} items)`);
    return data.items;
  }
  return data;
}
