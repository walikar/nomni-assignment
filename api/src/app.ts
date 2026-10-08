import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import type { Pool } from './db/pool';
import { demoRouter } from './demo/router';
import { ordersRouter } from './orders/router';
import { PayloadError } from './orders/types';
import { UpstreamError, type UberClient } from './providers/uberClient';
import { uberMockRouter } from './providers/uberMock';
import { webhookRouter } from './webhooks/router';

export interface AppDeps {
  pool: Pool;
  uber: UberClient;
  uberClientSecret: string;
  doordashWebhookToken: string;
  adminOrigins?: string[];
  mockUber?: boolean;
  demoMode?: boolean;
  selfUrl?: () => string;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/', (_req, res) => {
    res.json({
      name: 'Marketplace Orders API',
      endpoints: {
        webhook: 'POST /webhooks/orders (Uber Eats and DoorDash; provider detected from the payload)',
        orders: 'GET /api/orders, GET /api/orders/:id, POST /api/orders/:id/advance',
        health: 'GET /health',
      },
    });
  });
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(webhookRouter(deps));

  const api = express.Router();
  api.use(cors({ origin: deps.adminOrigins ?? ['http://localhost:3000'] }));
  api.use(ordersRouter(deps.pool));
  api.use(
    demoRouter({
      enabled: Boolean(deps.demoMode && deps.selfUrl),
      pool: deps.pool,
      selfUrl: deps.selfUrl ?? (() => ''),
      uberClientSecret: deps.uberClientSecret,
      doordashWebhookToken: deps.doordashWebhookToken,
    }),
  );
  app.use('/api', api);

  if (deps.mockUber) app.use('/mock/uber', uberMockRouter());

  app.use(errorHandler);
  return app;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof PayloadError) {
    res.status(422).json({ error: 'invalid_payload', message: err.message });
    return;
  }
  if (err instanceof UpstreamError) {
    console.warn(err.message);
    res.status(502).json({ error: 'upstream_error', message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
};
