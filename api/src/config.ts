import 'dotenv/config';

export interface Config {
  port: number;
  databaseUrl: string;
  uberClientSecret: string;
  uberAccessToken: string;
  uberApiBase: string;
  mockUber: boolean;
  doordashWebhookToken: string;
  adminOrigins: string[];
  demoMode: boolean;
  /** Where the API can reach itself (demo endpoint, Uber mock). */
  selfUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 4000);
  const selfUrl = `http://127.0.0.1:${port}`;
  const mockUber = env.MOCK_UBER === '1';
  return {
    port,
    databaseUrl: env.DATABASE_URL ?? 'postgres://localhost:5432/marketplace_orders',
    uberClientSecret: required(env, 'UBER_CLIENT_SECRET'),
    uberAccessToken: env.UBER_ACCESS_TOKEN ?? '',
    // With the mock on and no explicit base, Get Order goes to this same process.
    uberApiBase: env.UBER_API_BASE ?? (mockUber ? `${selfUrl}/mock/uber` : 'https://api.uber.com'),
    mockUber,
    doordashWebhookToken: required(env, 'DOORDASH_WEBHOOK_TOKEN'),
    // Comma-separated, e.g. the Vercel production URL plus localhost.
    adminOrigins: (env.ADMIN_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
    demoMode: env.DEMO_MODE === '1',
    selfUrl,
  };
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required env var ${key} (see api/.env.example)`);
  return value;
}
