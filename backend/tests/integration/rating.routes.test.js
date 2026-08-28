import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { default: app } = await import('../../src/app.js');

describe('Phase 14 rating route contracts', () => {
  test('reading a customer rating requires authentication', async () => {
    const response = await request(app).get(
      '/api/v1/orders/507f1f77bcf86cd799439011/rating',
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('submitting a customer rating requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/orders/507f1f77bcf86cd799439011/rating')
      .send({ score: 5, feedback: 'Great delivery.' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('reading received partner reviews requires authentication', async () => {
    const response = await request(app).get('/api/v1/partner/ratings');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
