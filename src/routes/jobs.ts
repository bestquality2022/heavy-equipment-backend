
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../lib/db.js';
import { uuid } from '../lib/ids.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { calcEtaIso } from '../lib/eta.js';

export const jobsRouter = Router();

const updatesDir = path.join(process.cwd(), 'uploads', 'job-updates');
fs.mkdirSync(updatesDir, { recursive: true });
const upload = multer({ dest: updatesDir });

function isOwnerOrAdmin(user:any, job:any) {
  return user.role === 'ADMIN' || job.customer_id === user.id;
}

// admin list jobs
jobsRouter.get('/', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const rows = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
  return res.json(rows);
});

// customer jobs
jobsRouter.get('/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  const rows = db.prepare('SELECT * FROM jobs WHERE customer_id=? ORDER BY created_at DESC').all(user.id);
  return res.json(rows);
});

// job detail
jobsRouter.get('/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id) as any;
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (!isOwnerOrAdmin(user, job)) return res.status(403).json({ error: 'Forbidden' });
  return res.json(job);
});

// status update (admin/operator)
const statusSchema = z.object({ status: z.string().min(1) });
jobsRouter.patch('/:id/status', requireAuth, requireRole(['ADMIN','OPERATOR']), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id) as any;
  if (!job) return res.status(404).json({ error: 'Not found' });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  db.prepare('UPDATE jobs SET status=? WHERE id=?').run(parsed.data.status, job.id);
  const updated = db.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);
  return res.json(updated);
});

// get updates
jobsRouter.get('/:id/updates', requireAuth, (req, res) => {
  const user = (req as any).user;
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id) as any;
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (!isOwnerOrAdmin(user, job)) return res.status(403).json({ error: 'Forbidden' });

  const updates = db.prepare('SELECT * FROM job_updates WHERE job_id=? ORDER BY created_at DESC').all(job.id);
  return res.json(updates);
});

// add update with optional image (admin/operator)
jobsRouter.post('/:id/updates', requireAuth, requireRole(['ADMIN','OPERATOR']), upload.single('file'), (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id) as any;
  if (!job) return res.status(404).json({ error: 'Not found' });

  const id = uuid();
  const message = (req.body?.message as string) || null;
  const imageUrl = req.file ? `/uploads/job-updates/${req.file.filename}` : null;

  db.prepare('INSERT INTO job_updates (id, job_id, message, image_url) VALUES (?,?,?,?)')
    .run(id, job.id, message, imageUrl);

  const created = db.prepare('SELECT * FROM job_updates WHERE id=?').get(id);
  return res.status(201).json(created);
});

// GPS update (operator/admin) - lightweight HTTP version for local testing
const gpsSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

jobsRouter.post('/:id/gps', requireAuth, requireRole(['ADMIN','OPERATOR']), (req, res) => {
  const parsed = gpsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id) as any;
  if (!job) return res.status(404).json({ error: 'Not found' });

  let eta: string | null = job.eta;
  if (job.dest_lat != null && job.dest_lng != null) {
    eta = calcEtaIso(parsed.data.lat, parsed.data.lng, job.dest_lat, job.dest_lng, 50);
  }

  db.prepare('UPDATE jobs SET lat=?, lng=?, eta=? WHERE id=?').run(parsed.data.lat, parsed.data.lng, eta, job.id);
  const updated = db.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);
  return res.json(updated);
});
