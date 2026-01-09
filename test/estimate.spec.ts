
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { migrate } from '../src/lib/db.js';
import { authRouter } from '../src/routes/auth.js';
import { estimatesRouter } from '../src/routes/estimates.js';

describe('Estimates', () => {
  const app = express();
  let token = '';

  beforeAll(async () => {
    migrate();
    app.use(cors());
    app.use(express.json());
    app.use('/auth', authRouter);
    app.use('/estimates', estimatesRouter);

    const email = `cust_${Date.now()}@example.com`;
    await request(app).post('/auth/register').send({ name:'Cust', email, password:'123456' }).expect(201);
    const res = await request(app).post('/auth/login').send({ email, password:'123456' }).expect(201);
    token = res.body.accessToken;
  });

  it('creates estimate', async () => {
    const res = await request(app)
      .post('/estimates')
      .set('Authorization', `Bearer ${token}`)
      .send({ service:'Land Clearing', description:'Test job' })
      .expect(201);
    expect(res.body.id).toBeTruthy();
  });
});
