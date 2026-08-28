import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { default: app } = await import('../../src/app.js');

describe('Phase 13 admin operations route contracts', () => {
  test('admin order queue requires authentication', async () => {
    const response = await request(app).get('/api/v1/admin/orders');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('admin order detail requires authentication', async () => {
    const response = await request(app).get(
      '/api/v1/admin/orders/507f1f77bcf86cd799439011',
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
