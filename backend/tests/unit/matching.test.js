import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const { MATCHING_PARTNER_MODE, MATCHING_REJECTION_REASON } = await import(
  '../../src/constants/matching.constants.js'
);
const { TRIP_STATUS } = await import('../../src/constants/partner.constants.js');
const { evaluateTripGeometry, rankCandidates } = await import(
  '../../src/services/matching.service.js'
);

describe('Phase 6 matching rules', () => {
  const trip = {
    _id: new mongoose.Types.ObjectId(),
    status: TRIP_STATUS.SCHEDULED,
    origin: { type: 'Point', coordinates: [81.80, 25.40] },
    destination: { type: 'Point', coordinates: [81.90, 25.40] },
  };

  test('scheduled on-my-way geometry requires pickup before drop', () => {
    const good = evaluateTripGeometry({
      trip,
      pickup: { longitude: 81.83, latitude: 25.40 },
      drop: { longitude: 81.87, latitude: 25.40 },
    });
    expect(good.eligible).toBe(true);

    const reversed = evaluateTripGeometry({
      trip,
      pickup: { longitude: 81.87, latitude: 25.40 },
      drop: { longitude: 81.83, latitude: 25.40 },
    });
    expect(reversed).toEqual({
      eligible: false,
      reason: MATCHING_REJECTION_REASON.WRONG_ROUTE_DIRECTION,
    });
  });

  test('active trip rejects pickup that has already been substantially passed', () => {
    const activeTrip = { ...trip, status: TRIP_STATUS.ACTIVE };
    const result = evaluateTripGeometry({
      trip: activeTrip,
      currentLocation: { longitude: 81.88, latitude: 25.40 },
      pickup: { longitude: 81.83, latitude: 25.40 },
      drop: { longitude: 81.89, latitude: 25.40 },
    });

    expect(result).toEqual({
      eligible: false,
      reason: MATCHING_REJECTION_REASON.PICKUP_ALREADY_PASSED,
    });
  });

  test('ranking prefers materially earlier delivery', () => {
    const base = {
      partnerId: new mongoose.Types.ObjectId(),
      tripId: null,
      routeSource: 'DEV_APPROXIMATION',
      predictedPickupAt: new Date('2026-08-27T16:00:00.000Z'),
      pickupTravelSeconds: 300,
      totalDeliveryTravelSeconds: 1200,
      additionalDetourSeconds: null,
      additionalDetourMeters: null,
      pickupDistanceMeters: 1000,
      completedOrderCount: 0,
      ratingAverage: 0,
    };

    const later = {
      ...base,
      partnerId: new mongoose.Types.ObjectId(),
      mode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
      predictedDeliveryAt: new Date('2026-08-27T16:25:00.000Z'),
    };
    const earlier = {
      ...base,
      partnerId: new mongoose.Types.ObjectId(),
      mode: MATCHING_PARTNER_MODE.TRIP_ACTIVE,
      predictedDeliveryAt: new Date('2026-08-27T16:15:00.000Z'),
      additionalDetourSeconds: 240,
      additionalDetourMeters: 600,
    };

    const ranked = rankCandidates([later, earlier]);
    expect(ranked[0].partnerId.toString()).toBe(earlier.partnerId.toString());
    expect(ranked[0].rankPosition).toBe(1);
  });

  test('near-equal delivery prefers efficient on-my-way supply', () => {
    const availablePartnerId = new mongoose.Types.ObjectId();
    const onWayPartnerId = new mongoose.Types.ObjectId();
    const common = {
      routeSource: 'DEV_APPROXIMATION',
      predictedPickupAt: new Date('2026-08-27T16:00:00.000Z'),
      pickupTravelSeconds: 300,
      totalDeliveryTravelSeconds: 1200,
      pickupDistanceMeters: 1000,
      completedOrderCount: 0,
      ratingAverage: 0,
    };

    const ranked = rankCandidates([
      {
        ...common,
        partnerId: availablePartnerId,
        tripId: null,
        mode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
        predictedDeliveryAt: new Date('2026-08-27T16:20:20.000Z'),
        additionalDetourSeconds: null,
        additionalDetourMeters: null,
      },
      {
        ...common,
        partnerId: onWayPartnerId,
        tripId: new mongoose.Types.ObjectId(),
        mode: MATCHING_PARTNER_MODE.TRIP_ACTIVE,
        predictedDeliveryAt: new Date('2026-08-27T16:20:00.000Z'),
        additionalDetourSeconds: 180,
        additionalDetourMeters: 500,
      },
    ]);

    expect(ranked[0].partnerId.toString()).toBe(onWayPartnerId.toString());
  });
});
