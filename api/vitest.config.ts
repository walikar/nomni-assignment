import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

dotenv.config();

export default defineConfig({
  test: {
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 15000,
    // Settings for the app while testing. These win over api/.env.
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgres://localhost:5432/marketplace_orders_test',
      UBER_CLIENT_SECRET: 'test-uber-secret',
      DOORDASH_WEBHOOK_TOKEN: 'test-doordash-token',
      UBER_ACCESS_TOKEN: 'test-access-token',
      MOCK_UBER: '0',
      DEMO_MODE: '1',
      ADMIN_ORIGIN: 'http://localhost:3000',
    },
  },
});
