import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import analytics from './routes/analytics.js';
import map from './routes/map.js';
import reviews from './routes/reviews.js';
import users from './routes/users.js';
import restaurants from './routes/restaurants.js';
import orders from './routes/orders.js';
import checkout from './routes/checkout.js';
import { ApiError } from './errors.js';

const app = express();

// CLIENT_ORIGIN may list several origins separated by commas.
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({ origin: origins }));
app.use(express.json());

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', mode: process.env.DEMO_MODE === 'true' ? 'demo' : 'database' })
);

// Screens 1-3: Browse, Transaction (Workflow 1), Audit
app.use('/api/users', users);
app.use('/api/restaurants', restaurants);
app.use('/api/orders', orders);
app.use('/api/checkout', checkout);

// Screens 4-6: Analytics (Workflow 2), Map (Workflow 3), Reviews (Workflow 4)
app.use('/api/analytics', analytics);
app.use('/api/map', map);
app.use('/api/reviews', reviews);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.', code: 'NOT_FOUND' }));

// Errors keep the `{ error: <message> }` shape the web client already reads;
// `code` lets screens show a specific message (see docs/api_endpoints.md).
app.use((err, _req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...err.details });
  }

  console.error(err);
  res.status(500).json({
    error: 'The request failed. Check the API terminal and database configuration.',
    code: 'INTERNAL_ERROR',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;
