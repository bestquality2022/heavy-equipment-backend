
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { migrate } from '../src/lib/db.js';
import { authRouter } from '../src/routes/auth.js';

describe('Auth', () => {
  const app = express();
  beforeAll(() => {
    migrate();
    app.use(cors());
    app.use(express.json());
    app.use('/auth', authRouter);
  });

  it('register/login', async () => {
    const email = `test_${Date.now()}@example.com`;
    await request(app).post('/auth/register').send({ name:'Test', email, password:'123456' }).expect(201);
    const res = await request(app).post('/auth/login').send({ email, password:'123456' }).expect(201);
    expect(res.body.accessToken).toBeTruthy();
  });
});
