import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173';
process.env.RAZORPAY_WEBHOOK_SECRET ??= 'routebite-webhook-test-secret';

const { default: app } = await import('../../src/app.js');

describe('Razorpay webhook route contract', () => {
  test('invalid webhook signature is rejected without customer authentication', async () => {
    const response = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', 'evt_test_invalid_signature')
      .set('x-razorpay-signature', '0'.repeat(64))
      .send(JSON.stringify({ event: 'payment.captured' }));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('RAZORPAY_WEBHOOK_SIGNATURE_INVALID');
  });
});
