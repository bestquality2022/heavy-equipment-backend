"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_js_1 = require("../lib/db.js");
const ids_js_1 = require("../lib/ids.js");
const auth_js_1 = require("../lib/auth.js");
// NOTE: This is a local stub to test payment flows without Stripe configuration.
// You can later replace this with Stripe PaymentIntents + webhooks.
exports.paymentsRouter = (0, express_1.Router)();
const intentSchema = zod_1.z.object({
    amount: zod_1.z.number().int().positive(),
    jobId: zod_1.z.string().optional()
});
exports.paymentsRouter.post('/intent', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const parsed = intentSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const id = (0, ids_js_1.uuid)();
    db_js_1.db.prepare('INSERT INTO payments (id, user_id, job_id, amount, status, provider, provider_ref) VALUES (?,?,?,?,?,?,?)')
        .run(id, user.id, parsed.data.jobId ?? null, parsed.data.amount, 'PENDING', 'STRIPE', `test_${id}`);
    // Simulate a client secret
    return res.status(201).json({ id, client_secret: `pi_test_secret_${id}` });
});
exports.paymentsRouter.post('/:id/confirm', auth_js_1.requireAuth, (req, res) => {
    const user = req.user;
    const payment = db_js_1.db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id);
    if (!payment)
        return res.status(404).json({ error: 'Not found' });
    if (payment.user_id !== user.id)
        return res.status(403).json({ error: 'Forbidden' });
    db_js_1.db.prepare("UPDATE payments SET status='PAID' WHERE id=?").run(payment.id);
    const updated = db_js_1.db.prepare('SELECT * FROM payments WHERE id=?').get(payment.id);
    return res.json(updated);
});
