import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { default: app } = await import('../../src/app.js');

describe('auth route contract', () => {
  test('POST /api/v1/auth/register rejects invalid input before database access', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      phone: '9876543210',
      password: 'short',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });

  test('POST /api/v1/auth/login rejects missing credentials before database access', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('GET /api/v1/auth/me requires an auth cookie', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('email OTP request requires authentication', async () => {
    const response = await request(app).post('/api/v1/auth/email-otp/request');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('email OTP verification requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/auth/email-otp/verify')
      .send({ otp: '123456' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('POST /api/v1/auth/logout is safe when already logged out', async () => {
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: null });
    expect(response.headers['set-cookie']?.[0]).toContain('routebite_auth=');
  });
});
