process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const { DELIVERY_OPERATION_LIMITS } = await import('../../src/constants/delivery.constants.js');
const { Order } = await import('../../src/models/order.model.js');
const { distanceMeters } = await import('../../src/services/tracking.service.js');

describe('Phase 9 live tracking contracts', () => {
  test('foreground GPS cadence stays within the 10-15 second prototype target', () => {
    expect(DELIVERY_OPERATION_LIMITS.LIVE_LOCATION_INTERVAL_MS).toBeGreaterThanOrEqual(10000);
    expect(DELIVERY_OPERATION_LIMITS.LIVE_LOCATION_INTERVAL_MS).toBeLessThanOrEqual(15000);
  });

  test('order schema persists deliveryStartedAt', () => {
    expect(Order.schema.path('deliveryStartedAt')).toBeDefined();
  });

  test('straight-line distance is zero for the same point', () => {
    expect(
      distanceMeters(
        { latitude: 25.43, longitude: 81.77 },
        { latitude: 25.43, longitude: 81.77 },
      ),
    ).toBe(0);
  });

  test('straight-line distance uses realistic earth scale', () => {
    const meters = distanceMeters(
      { latitude: 25, longitude: 81 },
      { latitude: 26, longitude: 81 },
    );

    expect(meters).toBeGreaterThan(110000);
    expect(meters).toBeLessThan(112000);
  });
});
