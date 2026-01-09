"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimatesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const db_js_1 = require("../lib/db.js");
const ids_js_1 = require("../lib/ids.js");
const auth_js_1 = require("../lib/auth.js");
exports.estimatesRouter = (0, express_1.Router)();
const uploadDir = node_path_1.default.join(process.cwd(), 'uploads', 'estimates');
node_fs_1.default.mkdirSync(uploadDir, { recursive: true });
const upload = (0, multer_1.default)({ dest: uploadDir });
// PUBLIC estimate request (no auth)
exports.estimatesRouter.post('/public', (req, res) => {
    const parsed = zod_1.z.object({
        name: zod_1.z.string().min(1),
        phone: zod_1.z.string().min(1),
        service: zod_1.z.string().min(1),
        preferredAt: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    const estimateId = (0, ids_js_1.uuid)();
    db_js_1.db.prepare(`
    INSERT INTO estimates (id, customer_name, customer_phone, service, description, status)
    VALUES (?, ?, ?, ?, ?, 'NEW')
  `).run(estimateId, parsed.data.name, parsed.data.phone, parsed.data.service, parsed.data.description ?? null);
    return res.status(201).json({
        ok: true,
        estimateId,
    });
});
const createSchema = zod_1.z.object({
    service: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
});
function estimateWithPhotos(row) {
    const photos = db_js_1.db.prepare('SELECT id, url, created_at as createdAt FROM estimate_photos WHERE estimate_id=? ORDER BY created_at DESC')
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
        photos: photos.map((p) => ({ id: p.id, url: p.url, createdAt: p.createdAt }))
    };
}
// customer create
exports.estimatesRouter.post('/', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const id = (0, ids_js_1.uuid)();
    db_js_1.db.prepare('INSERT INTO estimates (id, customer_id, service, description) VALUES (?,?,?,?)')
        .run(id, user.id, parsed.data.service, parsed.data.description);
    const est = db_js_1.db.prepare('SELECT * FROM estimates WHERE id=?').get(id);
    return res.status(201).json(estimateWithPhotos(est));
});
// customer list
exports.estimatesRouter.get('/me', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const rows = db_js_1.db.prepare('SELECT * FROM estimates WHERE customer_id=? ORDER BY created_at DESC').all(user.id);
    return res.json(rows.map(estimateWithPhotos));
});
// admin list
exports.estimatesRouter.get('/', auth_js_1.requireAuth, (0, auth_js_1.requireRole)(['ADMIN']), (req, res) => {
    const rows = db_js_1.db.prepare('SELECT * FROM estimates ORDER BY created_at DESC').all();
    return res.json(rows.map(estimateWithPhotos));
});
// get detail (admin or owner)
exports.estimatesRouter.get('/:id', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const row = db_js_1.db.prepare('SELECT * FROM estimates WHERE id=?').get(req.params.id);
    if (!row)
        return res.status(404).json({ error: 'Not found' });
    if (user.role !== 'ADMIN' && row.customer_id !== user.id)
        return res.status(403).json({ error: 'Forbidden' });
    return res.json(estimateWithPhotos(row));
});
// upload photo (owner)
exports.estimatesRouter.post('/:id/photos', auth_js_1.requireAuth, upload.single('file'), (req, res) => {
    const user = req.user;
    const row = db_js_1.db.prepare('SELECT * FROM estimates WHERE id=?').get(req.params.id);
    if (!row)
        return res.status(404).json({ error: 'Not found' });
    if (row.customer_id !== user.id)
        return res.status(403).json({ error: 'Forbidden' });
    if (!req.file)
        return res.status(400).json({ error: 'Missing file' });
    const photoId = (0, ids_js_1.uuid)();
    const url = `/uploads/estimates/${req.file.filename}`;
    db_js_1.db.prepare('INSERT INTO estimate_photos (id, estimate_id, url) VALUES (?,?,?)').run(photoId, row.id, url);
    return res.status(201).json({ id: photoId, url });
});
// admin quote
const quoteSchema = zod_1.z.object({
    quotedAmount: zod_1.z.number().int().positive(),
    adminNotes: zod_1.z.string().optional(),
    scheduledAt: zod_1.z.string().optional(),
});
exports.estimatesRouter.patch('/:id/quote', auth_js_1.requireAuth, (0, auth_js_1.requireRole)(['ADMIN']), (req, res) => {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const row = db_js_1.db.prepare('SELECT * FROM estimates WHERE id=?').get(req.params.id);
    if (!row)
        return res.status(404).json({ error: 'Not found' });
    db_js_1.db.prepare(`UPDATE estimates SET quoted_amount=?, admin_notes=?, scheduled_at=?, status='QUOTED' WHERE id=?`)
        .run(parsed.data.quotedAmount, parsed.data.adminNotes ?? null, parsed.data.scheduledAt ?? null, row.id);
    const updated = db_js_1.db.prepare('SELECT * FROM estimates WHERE id=?').get(row.id);
    return res.json(estimateWithPhotos(updated));
});
// customer accept -> create job
exports.estimatesRouter.post('/:id/accept', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const row = db_js_1.db.prepare('SELECT * FROM estimates WHERE id=?').get(req.params.id);
    if (!row)
        return res.status(404).json({ error: 'Not found' });
    if (row.customer_id !== user.id)
        return res.status(403).json({ error: 'Forbidden' });
    if (row.status !== 'QUOTED')
        return res.status(400).json({ error: 'Estimate not quoted yet' });
    db_js_1.db.prepare(`UPDATE estimates SET status='ACCEPTED' WHERE id=?`).run(row.id);
    const createJob = String(req.query.createJob || 'false') === 'true';
    let jobId = null;
    if (createJob) {
        jobId = (0, ids_js_1.uuid)();
        db_js_1.db.prepare(`INSERT INTO jobs (id, customer_id, estimate_id, status) VALUES (?,?,?,?)`)
            .run(jobId, user.id, row.id, 'PENDING');
    }
    return res.status(201).json({ accepted: true, jobId });
});
