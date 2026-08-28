import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const { DELIVERY_OPERATION_LIMITS } = await import('../../src/constants/delivery.constants.js');
const { DELIVERY_TYPE, ORDER_STATUS } = await import('../../src/constants/order.constants.js');
const { Order } = await import('../../src/models/order.model.js');
const { PartnerEarning } = await import('../../src/models/partner-earning.model.js');
const { hashOtp } = await import('../../src/services/delivery-otp.service.js');

function validOrder(overrides = {}) {
  return new Order({
    customerId: new mongoose.Types.ObjectId(),
    status: ORDER_STATUS.DELIVERY_OTP_REQUIRED,
    vendorDisplayName: 'Sharma Chaat',
    requestedItems: '2 pav bhaji',
    pickup: { type: 'Point', coordinates: [81.8463, 25.4358] },
    pickupText: 'Civil Lines',
    drop: { type: 'Point', coordinates: [81.7712, 25.4298] },
    dropText: 'IIIT Allahabad',
    deliveryType: DELIVERY_TYPE.ASAP,
    deliveryWindowStart: new Date(),
    deliveryWindowEnd: new Date(Date.now() + 45 * 60 * 1000),
    assignedPartnerId: new mongoose.Types.ObjectId(),
    pricing: {
      estimatedFoodCostPaise: 20000,
      customerDeliveryChargePaise: 4000,
      partnerBaseEarningPaise: 4000,
      platformFeePaise: 1000,
      estimatedCustomerTotalPaise: 25000,
      finalCustomerTotalPaise: 25000,
    },
    ...overrides,
  });
}

describe('Phase 10 delivery OTP and completion invariants', () => {
  test('delivery OTP policy is six digits, five minutes, five attempts', () => {
    expect(DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_DIGITS).toBe(6);
    expect(DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_EXPIRY_MINUTES).toBe(5);
    expect(DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_MAX_ATTEMPTS).toBe(5);
  });

  test('OTP hash is deterministic, scoped to order, and never plaintext', () => {
    const orderA = new mongoose.Types.ObjectId().toString();
    const orderB = new mongoose.Types.ObjectId().toString();
    const first = hashOtp(orderA, '123456');

    expect(first).toHaveLength(64);
    expect(first).not.toContain('123456');
    expect(hashOtp(orderA, '123456')).toBe(first);
    expect(hashOtp(orderA, '654321')).not.toBe(first);
    expect(hashOtp(orderB, '123456')).not.toBe(first);
  });

  test('OTP hash is excluded from normal order queries', () => {
    expect(Order.schema.path('deliveryOtp.hash').options.select).toBe(false);
  });

  test('order persists OTP lifecycle and completion timestamps', () => {
    const now = new Date();
    const order = validOrder({
      deliveryOtpRequestedAt: now,
      deliveryOtp: {
        hash: hashOtp('test-order', '123456'),
        generatedAt: now,
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        attempts: 2,
        usedAt: null,
      },
      deliveredAt: null,
      completedAt: null,
    });

    expect(order.validateSync()).toBeUndefined();
    expect(order.deliveryOtp.attempts).toBe(2);
    expect(order.deliveryOtp.expiresAt).toBeInstanceOf(Date);
  });

  test('orders are indexed for OTP expiry inspection', () => {
    const index = Order.schema.indexes().find(
      ([keys]) => keys.status === 1 && keys['deliveryOtp.expiresAt'] === 1,
    );
    expect(index).toBeDefined();
  });

  test('one earning per order is enforced by a unique index', () => {
    const index = PartnerEarning.schema.indexes().find(
      ([keys], options]) => keys.orderId === 1 && options.unique === true,
    );
    expect(index).toBeDefined();
  });

  test('partner earning money must remain integer paise', () => {
    const earning = new PartnerEarning({
      orderId: new mongoose.Types.ObjectId(),
      partnerId: new mongoose.Types.ObjectId(),
      baseEarningPaise: 4000.5,
      incentivePaise: 0,
      totalEarningPaise: 4000.5,
      earnedAt: new Date(),
    });

    const error = earning.validateSync();
    expect(error.errors.baseEarningPaise).toBeDefined();
    expect(error.errors.totalEarningPaise).toBeDefined();
  });
});
