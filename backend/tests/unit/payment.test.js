import crypto from 'crypto';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';
process.env.RAZORPAY_KEY_ID ??= 'rzp_test_routebite';
process.env.RAZORPAY_KEY_SECRET ??= 'routebite-test-secret';

const { PAYMENT_STATUS } = await import('../../src/constants/payment.constants.js');
const { Payment } = await import('../../src/models/payment.model.js');
const { calculateCheckoutPricing } = await import('../../src/services/pricing.service.js');
const { verifyRazorpayPaymentSignature } = await import('../../src/services/razorpay.service.js');

describe('Phase 5 payment rules', () => {
  test('checkout pricing is calculated in integer paise on the backend', () => {
    expect(calculateCheckoutPricing(20000)).toEqual({
      estimatedFoodCostPaise: 20000,
      customerDeliveryChargePaise: 4000,
      partnerBaseEarningPaise: 4000,
      platformFeePaise: 1000,
      estimatedCustomerTotalPaise: 25000,
    });
  });

  test('checkout pricing rejects fractional paise', () => {
    expect(() => calculateCheckoutPricing(20000.5)).toThrow(
      'Estimated food cost must be a non-negative integer number of paise.',
    );
  });

  test('new payment attempt starts active in CREATED state', () => {
    const payment = new Payment({
      orderId: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(),
      amountPaise: 25000,
      idempotencyKey: 'payment-test-key-123',
    });

    expect(payment.status).toBe(PAYMENT_STATUS.CREATED);
    expect(payment.activeAttempt).toBe(true);
    expect(payment.validateSync()).toBeUndefined();
  });

  test('payment model rejects fractional paise', () => {
    const payment = new Payment({
      orderId: new mongoose.Types.ObjectId(),
      customerId: new mongoose.Types.ObjectId(),
      amountPaise: 25000.5,
      idempotencyKey: 'payment-test-key-456',
    });

    const error = payment.validateSync();
    expect(error.errors.amountPaise).toBeDefined();
  });

  test('Razorpay signature verification uses stored-order HMAC format', () => {
    const providerOrderId = 'order_routebite_test';
    const providerPaymentId = 'pay_routebite_test';
    const providerSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');

    expect(
      verifyRazorpayPaymentSignature({
        providerOrderId,
        providerPaymentId,
        providerSignature,
      }),
    ).toBe(true);

    expect(
      verifyRazorpayPaymentSignature({
        providerOrderId,
        providerPaymentId,
        providerSignature: '0'.repeat(64),
      }),
    ).toBe(false);
  });
});
