"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const db_js_1 = require("./lib/db.js");
const auth_js_1 = require("./routes/auth.js");
const estimates_js_1 = require("./routes/estimates.js");
const jobs_js_1 = require("./routes/jobs.js");
const payments_js_1 = require("./routes/payments.js");
(0, db_js_1.migrate)();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '2mb' }));
const uploadsRoot = node_path_1.default.join(process.cwd(), 'uploads');
node_fs_1.default.mkdirSync(uploadsRoot, { recursive: true });
app.use('/uploads', express_1.default.static(uploadsRoot));
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
app.use('/auth', auth_js_1.authRouter);
app.use('/estimates', estimates_js_1.estimatesRouter);
app.use('/jobs', jobs_js_1.jobsRouter);
app.use('/payments', payments_js_1.paymentsRouter);
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log(`API listening on port ${port}`);
});
