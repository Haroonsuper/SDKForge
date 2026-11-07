import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { webhookRouter } from './routes/webhook.js';
import { billingRouter } from './routes/billing.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // running behind a reverse proxy / load balancer
app.use(helmet());

// 1) Stripe webhooks FIRST: they need the raw body, so they are mounted before express.json().
app.use('/webhooks', webhookRouter);

// 2) Everything else is JSON with a small body limit, CORS allow-list and rate limiting.
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.corsOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Authorization', 'Content-Type']
}));
app.use(express.json({ limit: '10kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false }));
app.use('/api/billing', billingRouter);

app.get('/healthz', (_req, res) => { res.json({ ok: true }); });

// Final error handler: never leak stack traces.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled error', err);
  res.status(err.message === 'Origin not allowed by CORS' ? 403 : 500).json({ error: 'Request failed.' });
});

app.listen(config.port, () => {
  console.log(`SDKForge billing API listening on :${config.port}`);
});
