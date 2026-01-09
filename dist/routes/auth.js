"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
exports.authRouter = (0, express_1.Router)();
/**
 * DEV AUTH ONLY (Option A)
 * No real login, always returns admin user
 */
exports.authRouter.post('/login', (_req, res) => {
    return res.json({
        user: {
            id: 'dev-admin',
            role: 'ADMIN',
        },
    });
});
