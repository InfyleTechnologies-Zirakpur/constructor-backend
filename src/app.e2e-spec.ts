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

  it('/auth/register creates a job seeker user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Amit Kumar',
        email: 'amit@example.com',
        password: 'Pass1234!',
        phone: '+919999999999',
        role: 'job_seeker',
      })
      .expect(201);

    expect(response.body.user.email).toBe('amit@example.com');
    expect(response.body.user.role).toBe('job_seeker');
    expect(response.body.accessToken).toBeDefined();
  });

  it('/jobs creates a company job listing', async () => {
    const response = await request(app.getHttpServer())
      .post('/jobs')
      .send({
        title: 'Site Engineer',
        companyId: 'company-1',
        location: 'Bengaluru',
        skills: ['site supervision', 'autocad'],
        description: 'Need a project engineer for a residential site.',
        compensation: '₹60,000/month',
        workforceRequired: 2,
      })
      .expect(201);

    expect(response.body.data.title).toBe('Site Engineer');
    expect(response.body.data.status).toBe('draft');
  });

  it('/calculators/concrete provides a quantity estimate', async () => {
    const response = await request(app.getHttpServer())
      .get('/calculators/concrete')
      .query({ length: 10, breadth: 5, height: 0.3, mixRatio: '1:2:4' })
      .expect(200);

    expect(response.body.data.volumeM3).toBeCloseTo(15, 2);
    expect(response.body.data.cementBags).toBeGreaterThan(0);
  });
});
