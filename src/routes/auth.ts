
import { Router } from 'express';

export const authRouter = Router();

/**
 * DEV AUTH ONLY (Option A)
 * No real login, always returns admin user
 */

authRouter.post('/login', (_req, res) => {
  return res.json({
    user: {
      id: 'dev-admin',
      role: 'ADMIN',
    },
  });
});