import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name} (see api/.env.example)`);
  }
  return value;
}

const PORT = Number(process.env.PORT || 4000);
const MOCK_UBER = process.env.MOCK_UBER === '1';

// All settings in one place. Read from api/.env locally, and from the host's environment in production.
export const config = {
  PORT,
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost:5432/marketplace_orders',

  // --- Uber ---
  // Uber signs every webhook with this secret (HMAC-SHA256).
  UBER_CLIENT_SECRET: requireEnv('UBER_CLIENT_SECRET'),
  // Bearer token for Uber's Get Order API.
  UBER_ACCESS_TOKEN: process.env.UBER_ACCESS_TOKEN || '',
  // With MOCK_UBER=1 we serve Uber's sample order ourselves, because there is no live Uber account.
  MOCK_UBER,
  UBER_API_BASE: process.env.UBER_API_BASE || (MOCK_UBER ? `http://127.0.0.1:${PORT}/mock/uber` : 'https://api.uber.com'),

  // --- DoorDash ---
  // The Auth Token configured on the DoorDash webhook. DoorDash sends it in the Authorization header.
  DOORDASH_WEBHOOK_TOKEN: requireEnv('DOORDASH_WEBHOOK_TOKEN'),

  // --- Admin website ---
  // Websites allowed to call /api from the browser. Comma-separated.
  ADMIN_ORIGINS: (process.env.ADMIN_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // Turns on the "Try it" demo endpoint.
  DEMO_MODE: process.env.DEMO_MODE === '1',
};
