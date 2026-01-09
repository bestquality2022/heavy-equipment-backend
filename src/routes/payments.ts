
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { uuid } from '../lib/ids.js';
import { requireAuth } from '../lib/auth.js';

// NOTE: This is a local stub to test payment flows without Stripe configuration.
// You can later replace this with Stripe PaymentIntents + webhooks.

export const paymentsRouter = Router();

const intentSchema = z.object({
  amount: z.number().int().positive(),
  jobId: z.string().optional()
});

paymentsRouter.post('/intent', requireAuth, (req, res) => {
  const user = (req as any).user;
  const parsed = intentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const id = uuid();
  db.prepare('INSERT INTO payments (id, user_id, job_id, amount, status, provider, provider_ref) VALUES (?,?,?,?,?,?,?)')
    .run(id, user.id, parsed.data.jobId ?? null, parsed.data.amount, 'PENDING', 'STRIPE', `test_${id}`);

  // Simulate a client secret
  return res.status(201).json({ id, client_secret: `pi_test_secret_${id}` });
});

paymentsRouter.post('/:id/confirm', requireAuth, (req, res) => {
  const user = (req as any).user;
  const payment = db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id) as any;
  if (!payment) return res.status(404).json({ error: 'Not found' });
  if (payment.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });

  db.prepare("UPDATE payments SET status='PAID' WHERE id=?").run(payment.id);
  const updated = db.prepare('SELECT * FROM payments WHERE id=?').get(payment.id);
  return res.json(updated);
});
