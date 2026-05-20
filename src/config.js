export const config = {
  port: process.env.PORT || 3000,
  apiBaseUrl: process.env.API_BASE_URL || '',

  apify: {
    token: process.env.APIFY_API_KEY,
    postSearchActor: process.env.APIFY_POST_ACTOR || 'supreme_coder~linkedin-post',
    commentsActor: process.env.APIFY_COMMENTS_ACTOR || 'datadoping~linkedin-post-comments-scraper',
    reactionsActor: process.env.APIFY_REACTIONS_ACTOR || 'datadoping~linkedin-post-reactions-scraper-no-cookie',
    feedActor: process.env.APIFY_FEED_ACTOR || 'curious_coder~linkedin-feed-posts-scraper',
    connectionsActor: process.env.APIFY_CONNECTIONS_ACTOR || 'data_link_miner~linkedin-network-scraper',
    messagesActor: process.env.APIFY_MESSAGES_ACTOR || '',
  },

  launchpad: {
    pit: process.env.LAUNCHPAD_PIT_TOKEN,
    locationId: process.env.LAUNCHPAD_LOCATION_ID,
    baseUrl: 'https://services.leadconnectorhq.com',
    version: '2021-07-28',
  },

  apollo: {
    apiKey: process.env.APOLLO_API_KEY,
    baseUrl: 'https://api.apollo.io/api/v1',
    revealPersonalEmails:
      (process.env.APOLLO_REVEAL_PERSONAL_EMAILS || 'true').toLowerCase() ===
      'true',
    verifiedEmailStatuses: (process.env.APOLLO_VERIFIED_EMAIL_STATUSES || 'verified,likely to engage')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },

  mongo: {
    uri: process.env.MONGODB_URI,
  },

  enrichment: {
    concurrency: parseInt(process.env.ENRICHMENT_CONCURRENCY || '4', 10),
    cacheTtlDays: parseInt(process.env.ENRICHMENT_CACHE_TTL_DAYS || '30', 10),
  },

  scrape: {
    pollIntervalMs: parseInt(process.env.SCRAPE_POLL_MS || '3000', 10),
    maxWaitMs: parseInt(process.env.SCRAPE_MAX_WAIT_MS || String(5 * 60 * 1000), 10),
  },
};

export function assertRequiredConfig() {
  if (!config.apify.token) {
    console.error('[config] Missing APIFY_API_KEY in .env.local');
    process.exit(1);
  }
  if (!config.launchpad.pit || !config.launchpad.locationId) {
    console.warn('[config] LAUNCHPAD_PIT_TOKEN / LAUNCHPAD_LOCATION_ID missing — /api/launchpad/push disabled');
  }
  if (!config.apollo.apiKey) {
    console.warn('[config] APOLLO_API_KEY missing — Apollo enrichment will be skipped');
  } else {
    console.log(`[config] Apollo enrichment enabled (key: ...${config.apollo.apiKey.slice(-4)})`);
  }
  if (!config.mongo.uri) {
    console.warn('[config] MONGODB_URI missing — using in-memory stores (non-persistent)');
  }
}
