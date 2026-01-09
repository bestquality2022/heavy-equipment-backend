
import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../lib/db.js';
import { uuid } from '../lib/ids.js';
import { requireAuth, requireRole } from '../lib/auth.js';

export const estimatesRouter = Router();

const uploadDir = path.join(process.cwd(), 'uploads', 'estimates');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
// PUBLIC estimate request (no auth)
estimatesRouter.post('/public', (req, res) => {
  const parsed = z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    service: z.string().min(1),
    preferredAt: z.string().optional(),
    description: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const estimateId = uuid();

  db.prepare(`
    INSERT INTO estimates (id, customer_name, customer_phone, service, description, status)
    VALUES (?, ?, ?, ?, ?, 'NEW')
  `).run(
    estimateId,
    parsed.data.name,
    parsed.data.phone,
    parsed.data.service,
    parsed.data.description ?? null
  );

  return res.status(201).json({
    ok: true,
    estimateId,
  });
});

const createSchema = z.object({
  service: z.string().min(1),
  description: z.string().min(1),
});

function estimateWithPhotos(row:any) {
  const photos = db.prepare('SELECT id, url, created_at as createdAt FROM estimate_photos WHERE estimate_id=? ORDER BY created_at DESC')
    .all(row.id);
  return {
    id: row.id,
    customerId: row.customer_id,
    service: row.service,
    description: row.description,
    status: row.status,
    quotedAmount: row.quoted_amount,
    adminNotes: row.admin_notes,
    scheduledAt: row.scheduled_at,
    createdAt: row.created_at,
    photos: photos.map((p:any)=>({ id:p.id, url: p.url, createdAt: p.createdAt }))
  };
}

// customer create
estimatesRouter.post('/', requireAuth, (req, res) => {
  const user = (req as any).user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const id = uuid();
  db.prepare('INSERT INTO estimates (id, customer_id, service, description) VALUES (?,?,?,?)')
    .run(id, user.id, parsed.data.service, parsed.data.description);

  const est = db.prepare('SELECT * FROM estimates WHERE id=?').get(id);
  return res.status(201).json(estimateWithPhotos(est));
});

// customer list
estimatesRouter.get('/me', requireAuth, (req, res) => {
  const user = (req as any).user;
  const rows = db.prepare('SELECT * FROM estimates WHERE customer_id=? ORDER BY created_at DESC').all(user.id);
  return res.json(rows.map(estimateWithPhotos));
});

// admin list
estimatesRouter.get('/', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const rows = db.prepare('SELECT * FROM estimates ORDER BY created_at DESC').all();
  return res.json(rows.map(estimateWithPhotos));
});

// get detail (admin or owner)
estimatesRouter.get('/:id', requireAuth, (req, res) => {
  const user = (req as any).user;
  const row = db.prepare('SELECT * FROM estimates WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (user.role !== 'ADMIN' && row.customer_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
  return res.json(estimateWithPhotos(row));
});

// upload photo (owner)
estimatesRouter.post('/:id/photos', requireAuth, upload.single('file'), (req, res) => {
  const user = (req as any).user;
  const row = db.prepare('SELECT * FROM estimates WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.customer_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'Missing file' });

  const photoId = uuid();
  const url = `/uploads/estimates/${req.file.filename}`;
  db.prepare('INSERT INTO estimate_photos (id, estimate_id, url) VALUES (?,?,?)').run(photoId, row.id, url);
  return res.status(201).json({ id: photoId, url });
});

// admin quote
const quoteSchema = z.object({
  quotedAmount: z.number().int().positive(),
  adminNotes: z.string().optional(),
  scheduledAt: z.string().optional(),
});

estimatesRouter.patch('/:id/quote', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const row = db.prepare('SELECT * FROM estimates WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });

  db.prepare(`UPDATE estimates SET quoted_amount=?, admin_notes=?, scheduled_at=?, status='QUOTED' WHERE id=?`)
    .run(parsed.data.quotedAmount, parsed.data.adminNotes ?? null, parsed.data.scheduledAt ?? null, row.id);

  const updated = db.prepare('SELECT * FROM estimates WHERE id=?').get(row.id);
  return res.json(estimateWithPhotos(updated));
});

// customer accept -> create job
estimatesRouter.post('/:id/accept', requireAuth, (req, res) => {
  const user = (req as any).user;
  const row = db.prepare('SELECT * FROM estimates WHERE id=?').get(req.params.id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.customer_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
  if (row.status !== 'QUOTED') return res.status(400).json({ error: 'Estimate not quoted yet' });

  db.prepare(`UPDATE estimates SET status='ACCEPTED' WHERE id=?`).run(row.id);

  const createJob = String(req.query.createJob || 'false') === 'true';
  let jobId: string | null = null;

  if (createJob) {
    jobId = uuid();
    db.prepare(`INSERT INTO jobs (id, customer_id, estimate_id, status) VALUES (?,?,?,?)`)
      .run(jobId, user.id, row.id, 'PENDING');
  }

  return res.status(201).json({ accepted: true, jobId });
});
