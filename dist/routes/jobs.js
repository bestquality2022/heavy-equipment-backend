"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const multer_1 = __importDefault(require("multer"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const db_js_1 = require("../lib/db.js");
const ids_js_1 = require("../lib/ids.js");
const auth_js_1 = require("../lib/auth.js");
const eta_js_1 = require("../lib/eta.js");
exports.jobsRouter = (0, express_1.Router)();
const updatesDir = node_path_1.default.join(process.cwd(), 'uploads', 'job-updates');
node_fs_1.default.mkdirSync(updatesDir, { recursive: true });
const upload = (0, multer_1.default)({ dest: updatesDir });
function isOwnerOrAdmin(user, job) {
    return user.role === 'ADMIN' || job.customer_id === user.id;
}
// admin list jobs
exports.jobsRouter.get('/', auth_js_1.requireAuth, (0, auth_js_1.requireRole)(['ADMIN']), (req, res) => {
    const rows = db_js_1.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
    return res.json(rows);
});
// customer jobs
exports.jobsRouter.get('/me', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const rows = db_js_1.db.prepare('SELECT * FROM jobs WHERE customer_id=? ORDER BY created_at DESC').all(user.id);
    return res.json(rows);
});
// job detail
exports.jobsRouter.get('/:id', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const job = db_js_1.db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
    if (!job)
        return res.status(404).json({ error: 'Not found' });
    if (!isOwnerOrAdmin(user, job))
        return res.status(403).json({ error: 'Forbidden' });
    return res.json(job);
});
// status update (admin/operator)
const statusSchema = zod_1.z.object({ status: zod_1.z.string().min(1) });
exports.jobsRouter.patch('/:id/status', auth_js_1.requireAuth, (0, auth_js_1.requireRole)(['ADMIN', 'OPERATOR']), (req, res) => {
    const job = db_js_1.db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
    if (!job)
        return res.status(404).json({ error: 'Not found' });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    db_js_1.db.prepare('UPDATE jobs SET status=? WHERE id=?').run(parsed.data.status, job.id);
    const updated = db_js_1.db.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);
    return res.json(updated);
});
// get updates
exports.jobsRouter.get('/:id/updates', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const job = db_js_1.db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
    if (!job)
        return res.status(404).json({ error: 'Not found' });
    if (!isOwnerOrAdmin(user, job))
        return res.status(403).json({ error: 'Forbidden' });
    const updates = db_js_1.db.prepare('SELECT * FROM job_updates WHERE job_id=? ORDER BY created_at DESC').all(job.id);
    return res.json(updates);
});
// add update with optional image (admin/operator)
exports.jobsRouter.post('/:id/updates', auth_js_1.requireAuth, (0, auth_js_1.requireRole)(['ADMIN', 'OPERATOR']), upload.single('file'), (req, res) => {
    const job = db_js_1.db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
    if (!job)
        return res.status(404).json({ error: 'Not found' });
    const id = (0, ids_js_1.uuid)();
    const message = req.body?.message || null;
    const imageUrl = req.file ? `/uploads/job-updates/${req.file.filename}` : null;
    db_js_1.db.prepare('INSERT INTO job_updates (id, job_id, message, image_url) VALUES (?,?,?,?)')
        .run(id, job.id, message, imageUrl);
    const created = db_js_1.db.prepare('SELECT * FROM job_updates WHERE id=?').get(id);
    return res.status(201).json(created);
});
// GPS update (operator/admin) - lightweight HTTP version for local testing
const gpsSchema = zod_1.z.object({
    lat: zod_1.z.number(),
    lng: zod_1.z.number(),
});
exports.jobsRouter.post('/:id/gps', auth_js_1.requireAuth, (0, auth_js_1.requireRole)(['ADMIN', 'OPERATOR']), (req, res) => {
    const parsed = gpsSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const job = db_js_1.db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
    if (!job)
        return res.status(404).json({ error: 'Not found' });
    let eta = job.eta;
    if (job.dest_lat != null && job.dest_lng != null) {
        eta = (0, eta_js_1.calcEtaIso)(parsed.data.lat, parsed.data.lng, job.dest_lat, job.dest_lng, 50);
    }
    db_js_1.db.prepare('UPDATE jobs SET lat=?, lng=?, eta=? WHERE id=?').run(parsed.data.lat, parsed.data.lng, eta, job.id);
    const updated = db_js_1.db.prepare('SELECT * FROM jobs WHERE id=?').get(job.id);
    return res.json(updated);
});
