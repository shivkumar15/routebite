import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { default: app } = await import('../../src/app.js');

describe('Phase 12 recovery route auth', () => {
  test('customer cancellation requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/orders/507f1f77bcf86cd799439011/cancel')
      .send({ reason: 'test' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('partner cannot-complete recovery requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/partner/active-order/cannot-complete')
      .send({ reason: 'test' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
