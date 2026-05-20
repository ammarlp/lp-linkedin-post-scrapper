import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, assertRequiredConfig } from './src/config.js';
import { connectMongo } from './src/lib/db.js';
import searchRouter from './src/routes/search.js';
import launchpadRouter from './src/routes/launchpad.js';
import scrapeRouter from './src/routes/scrape.js';
import personalRouter from './src/routes/personal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

assertRequiredConfig();
await connectMongo();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.API_BASE_URL = ${JSON.stringify(config.apiBaseUrl)};`);
});

app.use('/api/search', searchRouter);
app.use('/api/launchpad', launchpadRouter);
app.use('/api/scrape', scrapeRouter);
app.use('/api/personal', personalRouter);

app.use((err, req, res, _next) => {
  console.error('[server] unhandled', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(config.port, () => {
  console.log(`LinkedIn scraper running at http://localhost:${config.port}`);
});
