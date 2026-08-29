import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const {
  DELIVERY_OPERATION_LIMITS,
  PRICE_ADJUSTMENT_STATUS,
} = await import('../../src/constants/delivery.constants.js');
const { DELIVERY_TYPE } = await import('../../src/constants/order.constants.js');
const { UPLOAD_PURPOSE } = await import('../../src/constants/partner.constants.js');
const { Order } = await import('../../src/models/order.model.js');

function validOrder(overrides = {}) {
  return new Order({
    customerId: new mongoose.Types.ObjectId(),
    vendorDisplayName: 'Sharma Chaat',
    requestedItems: '2 pav bhaji',
    pickup: { type: 'Point', coordinates: [81.8463, 25.4358] },
    pickupText: 'Civil Lines',
    drop: { type: 'Point', coordinates: [81.7712, 25.4298] },
    dropText: 'IIIT Allahabad',
    deliveryType: DELIVERY_TYPE.ASAP,
    deliveryWindowStart: new Date(),
    deliveryWindowEnd: new Date(Date.now() + 45 * 60 * 1000),
    pricing: {
      estimatedFoodCostPaise: 20000,
      customerDeliveryChargePaise: 4000,
      partnerBaseEarningPaise: 4000,
      platformFeePaise: 1000,
      estimatedCustomerTotalPaise: 25000,
    },
    ...overrides,
  });
}

describe('Phase 8 pickup and price adjustment persistence', () => {
  test('new order defaults to no price adjustment', async () => {
    const order = validOrder();
    expect(order.priceAdjustment.status).toBe(PRICE_ADJUSTMENT_STATUS.NONE);
    expect(order.priceAdjustment.actualFoodCostPaise).toBeUndefined();
    await expect(order.validate()).resolves.toBeUndefined();
  });

  test('actual and final money reject fractional paise', async () => {
    const order = validOrder({
      pricing: {
        estimatedFoodCostPaise: 20000,
        customerDeliveryChargePaise: 4000,
        partnerBaseEarningPaise: 4000,
        platformFeePaise: 1000,
        estimatedCustomerTotalPaise: 25000,
        finalCustomerTotalPaise: 26000.5,
      },
      priceAdjustment: {
        status: PRICE_ADJUSTMENT_STATUS.APPROVED,
        actualFoodCostPaise: 21000.5,
        differencePaise: 1000,
      },
    });

    const error = await order.validate().catch((validationError) => validationError);
    expect(error.errors['pricing.finalCustomerTotalPaise']).toBeDefined();
    expect(error.errors['priceAdjustment.actualFoodCostPaise']).toBeDefined();
  });

  test('price difference may be a signed integer for lower vendor prices', async () => {
    const order = validOrder({
      priceAdjustment: {
        status: PRICE_ADJUSTMENT_STATUS.AUTO_DECREASED,
        actualFoodCostPaise: 18000,
        differencePaise: -2000,
        reportedAt: new Date(),
        resolvedAt: new Date(),
      },
    });

    await expect(order.validate()).resolves.toBeUndefined();
    expect(order.priceAdjustment.differencePaise).toBe(-2000);
  });

  test('orders are indexed for durable price approval expiry scans', () => {
    const index = Order.schema.indexes().find(
      ([keys]) =>
        keys.status === 1 &&
        keys['priceAdjustment.approvalExpiresAt'] === 1,
    );
    expect(index).toBeDefined();
  });

  test('prototype price approval window remains three minutes', () => {
    expect(DELIVERY_OPERATION_LIMITS.PRICE_CONFIRMATION_TIMEOUT_MINUTES).toBe(3);
  });

  test('receipt proof has a dedicated private upload purpose', () => {
    expect(UPLOAD_PURPOSE.ORDER_RECEIPT).toBe('ORDER_RECEIPT');
  });
});
