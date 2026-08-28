import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { default: app } = await import('../../src/app.js');

const orderId = '507f1f77bcf86cd799439011';

describe('delivery OTP route contract', () => {
  test('customer OTP generation requires authentication', async () => {
    const response = await request(app).post(`/api/v1/orders/${orderId}/delivery-otp`);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('partner OTP request requires authentication', async () => {
    const response = await request(app).post('/api/v1/partner/active-order/request-delivery-otp');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('partner OTP verification requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/partner/active-order/verify-delivery-otp')
      .send({ otp: '123456' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});
