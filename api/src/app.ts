import cors from 'cors';
import express from 'express';
import { config } from './config';
import demoRouter from './routes/demo';
import ordersRouter from './routes/orders';
import uberMockRouter from './routes/uber-mock';
import webhooksRouter from './routes/webhooks';

// Builds the Express app. Kept separate from index.ts so tests can use the app without starting a server.
export function createApp() {
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

  // Webhooks read the raw body themselves (for Uber's signature), so no JSON parser here.
  app.use('/webhooks', webhooksRouter);

  // Everything under /api is called by the admin website.
  app.use('/api', cors({ origin: config.ADMIN_ORIGINS }));
  app.use('/api/orders', express.json(), ordersRouter);
  app.use('/api/demo', express.json(), demoRouter);

  if (config.MOCK_UBER) {
    app.use('/mock/uber', uberMockRouter);
  }

  return app;
}
