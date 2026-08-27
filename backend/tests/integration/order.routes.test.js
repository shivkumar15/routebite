import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';

const { default: app } = await import('../../src/app.js');

describe('order route contract', () => {
  test('creating an order requires authentication', async () => {
    const response = await request(app).post('/api/v1/orders').send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('listing orders requires authentication', async () => {
    const response = await request(app).get('/api/v1/orders');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('editing an order requires authentication', async () => {
    const response = await request(app)
      .patch('/api/v1/orders/507f1f77bcf86cd799439011')
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('creating a payment attempt requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/orders/507f1f77bcf86cd799439011/payment')
      .set('Idempotency-Key', 'test-payment-key')
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('reading payment status requires authentication', async () => {
    const response = await request(app)
      .get('/api/v1/orders/507f1f77bcf86cd799439011/payment');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('payment verification requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/orders/507f1f77bcf86cd799439011/payment/verify')
      .send({});
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('reading matching state requires authentication', async () => {
    const response = await request(app)
      .get('/api/v1/orders/507f1f77bcf86cd799439011/matching');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('price increase approval requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/orders/507f1f77bcf86cd799439011/price-adjustment/approve');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  test('price increase rejection requires authentication', async () => {
    const response = await request(app)
      .post('/api/v1/orders/507f1f77bcf86cd799439011/price-adjustment/reject');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });
});