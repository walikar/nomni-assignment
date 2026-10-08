import { createApp } from './app';
import { loadConfig } from './config';
import { migrate } from './db/migrate';
import { createPool } from './db/pool';
import { createUberClient } from './providers/uberClient';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
// Hosted Postgres (e.g. Neon) drops idle connections; log it instead of crashing the process.
pool.on('error', (err) => console.warn('Postgres idle client error:', err.message));

const applied = await migrate(pool);
if (applied.length) console.log(`Applied migrations: ${applied.join(', ')}`);

const app = createApp({
  pool,
  uber: createUberClient({ baseUrl: config.uberApiBase, accessToken: config.uberAccessToken }),
  uberClientSecret: config.uberClientSecret,
  doordashWebhookToken: config.doordashWebhookToken,
  adminOrigins: config.adminOrigins,
  mockUber: config.mockUber,
  demoMode: config.demoMode,
  selfUrl: () => config.selfUrl,
});

app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
  if (config.mockUber) console.log(`Uber Get Order is mocked at ${config.uberApiBase}`);
  if (config.demoMode) console.log('Demo mode on: POST /api/demo/orders');
});
