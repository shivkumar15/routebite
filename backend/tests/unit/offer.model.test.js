import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/routebite-test-not-used';
process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough-for-routebite-tests';

const { MATCHING_PARTNER_MODE } = await import('../../src/constants/matching.constants.js');
const { OFFER_LIMITS, OFFER_STATUS } = await import('../../src/constants/offer.constants.js');
const { Offer } = await import('../../src/models/offer.model.js');

describe('Phase 7 offer persistence rules', () => {
  function validOffer(overrides = {}) {
    return new Offer({
      matchingAttemptId: new mongoose.Types.ObjectId(),
      orderId: new mongoose.Types.ObjectId(),
      partnerId: new mongoose.Types.ObjectId(),
      partnerMode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
      round: 1,
      rankPosition: 1,
      expiresAt: new Date(Date.now() + OFFER_LIMITS.TIMEOUT_SECONDS * 1000),
      predictedPickupAt: new Date(Date.now() + 5 * 60 * 1000),
      predictedDeliveryAt: new Date(Date.now() + 20 * 60 * 1000),
      expectedEarningPaise: 4000,
      ...overrides,
    });
  }

  test('new delivery offer defaults to PENDING', async () => {
    const offer = validOffer();
    expect(offer.status).toBe(OFFER_STATUS.PENDING);
    await expect(offer.validate()).resolves.toBeUndefined();
  });

  test('offer earning must be integer paise', async () => {
    const offer = validOffer({ expectedEarningPaise: 4000.5 });
    const error = await offer.validate().catch((validationError) => validationError);
    expect(error.errors.expectedEarningPaise).toBeDefined();
  });

  test('one matching attempt cannot offer the same partner twice', () => {
    const index = Offer.schema.indexes().find(
      ([keys, options]) =>
        keys.matchingAttemptId === 1 &&
        keys.partnerId === 1 &&
        options.unique === true,
    );
    expect(index).toBeDefined();
  });

  test('database schema permits only one ACCEPTED offer per order', () => {
    const index = Offer.schema.indexes().find(
      ([keys, options]) =>
        keys.orderId === 1 &&
        keys.status === 1 &&
        options.unique === true &&
        options.partialFilterExpression?.status === OFFER_STATUS.ACCEPTED,
    );
    expect(index).toBeDefined();
  });

  test('offer timeout remains the 20 second prototype contract', () => {
    expect(OFFER_LIMITS.TIMEOUT_SECONDS).toBe(20);
  });
});
