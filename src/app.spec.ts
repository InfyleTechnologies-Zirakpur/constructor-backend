process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module.js';

describe('Construction Platform API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/register creates a unique user and /auth/login works', async () => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    // Test Registration
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'E2E Test User',
        email: uniqueEmail,
        password: 'Password123!',
        phone: '+919999999999',
        role: 'job_seeker',
      })
      .expect(201);

    expect(registerResponse.body.user.email).toBe(uniqueEmail);
    expect(registerResponse.body.accessToken).toBeDefined();

    // Test Login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: uniqueEmail,
        password: 'Password123!',
      })
      .expect(200);

    expect(loginResponse.body.accessToken).toBeDefined();

    // Test Protected Route
    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    expect(meResponse.body.email).toBe(uniqueEmail);
  });
});
