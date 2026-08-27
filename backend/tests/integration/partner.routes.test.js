import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { default: app } = await import('../../src/app.js');

describe('partner verification route contract', () => {
  test('partner application requires authentication', async () => {
    const response = await request(app).post('/api/v1/partner/apply').send({});

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('private uploads require authentication', async () => {
    const response = await request(app).post('/api/v1/uploads');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('admin partner queue requires authentication', async () => {
    const response = await request(app).get('/api/v1/admin/partners/pending');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('phone OTP request requires authentication', async () => {
    const response = await request(app).post('/api/v1/auth/phone-otp/request');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
