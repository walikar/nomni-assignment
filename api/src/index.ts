import { createApp } from './app';
import { config } from './config';
import { runMigrations } from './db/migrate';

async function start() {
  // Create or update the database tables before accepting requests.
  const applied = await runMigrations();
  if (applied.length > 0) {
    console.log(`Applied migrations: ${applied.join(', ')}`);
  }

  const app = createApp();

  app.listen(config.PORT, () => {
    console.log(`Marketplace Orders API running on port ${config.PORT}`);
    if (config.MOCK_UBER) console.log(`Uber Get Order is mocked at ${config.UBER_API_BASE}`);
    if (config.DEMO_MODE) console.log('Demo mode on: POST /api/demo/orders');
  });
}

start().catch((err) => {
  console.error('Failed to start the API:', err);
  process.exit(1);
});
