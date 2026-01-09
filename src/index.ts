
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';

import { migrate } from './lib/db.js';
import { authRouter } from './routes/auth.js';
import { estimatesRouter } from './routes/estimates.js';
import { jobsRouter } from './routes/jobs.js';
import { paymentsRouter } from './routes/payments.js';

migrate();

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

const uploadsRoot = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsRoot, { recursive: true });
app.use('/uploads', express.static(uploadsRoot));

/** Root check */
app.get('/', (_req, res) => {
  res.json({
    service: 'Best Quality Heavy Equipment API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

/** Health check for Render */
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/** API Routes */
app.use('/auth', authRouter);
app.use('/estimates', estimatesRouter);
app.use('/jobs', jobsRouter);
app.use('/payments', paymentsRouter);

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
