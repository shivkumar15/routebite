import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const { DELIVERY_TYPE, ORDER_STATUS } = await import('../../src/constants/order.constants.js');
const { Order } = await import('../../src/models/order.model.js');
const { resolveDeliveryWindow } = await import('../../src/services/order.service.js');

describe('Phase 4 order draft rules', () => {
  test('new order defaults to DRAFT and stores longitude before latitude', async () => {
    const order = new Order({
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
      pricing: { estimatedFoodCostPaise: 20000 },
    });

    expect(order.status).toBe(ORDER_STATUS.DRAFT);
    expect(order.pickup.coordinates).toEqual([81.8463, 25.4358]);
    await expect(order.validate()).resolves.toBeUndefined();
  });

  test('authoritative food cost rejects fractional paise', async () => {
    const order = new Order({
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
      pricing: { estimatedFoodCostPaise: 20000.5 },
    });

    const error = await order.validate().catch((validationError) => validationError);
    expect(error.errors['pricing.estimatedFoodCostPaise']).toBeDefined();
  });

  test('ASAP creates a 45 minute server-side window', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');
    const result = resolveDeliveryWindow({ deliveryType: DELIVERY_TYPE.ASAP }, now);
    expect(result.start.toISOString()).toBe(now.toISOString());
    expect(result.end.getTime() - result.start.getTime()).toBe(45 * 60 * 1000);
  });

  test('scheduled delivery rejects a past start', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');
    expect(() => resolveDeliveryWindow({
      deliveryType: DELIVERY_TYPE.SCHEDULED,
      deliveryWindowStart: '2026-08-27T11:00:00.000Z',
      deliveryWindowEnd: '2026-08-27T13:00:00.000Z',
    }, now)).toThrow('Scheduled delivery must start in the future.');
  });

  test('scheduled delivery rejects end before start', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');
    expect(() => resolveDeliveryWindow({
      deliveryType: DELIVERY_TYPE.SCHEDULED,
      deliveryWindowStart: '2026-08-27T14:00:00.000Z',
      deliveryWindowEnd: '2026-08-27T13:00:00.000Z',
    }, now)).toThrow('Delivery window end must be after its start.');
  });
});
