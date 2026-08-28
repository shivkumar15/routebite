import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import {
  MATCHING_ATTEMPT_STATUS,
  MATCHING_PARTNER_MODE,
} from '../src/constants/matching.constants.js';
import { OFFER_STATUS } from '../src/constants/offer.constants.js';
import { DELIVERY_TYPE, ORDER_STATUS } from '../src/constants/order.constants.js';
import {
  PARTNER_AVAILABILITY_STATUS,
  PARTNER_VERIFICATION_STATUS,
} from '../src/constants/partner.constants.js';
import { MatchingAttempt } from '../src/models/matching-attempt.model.js';
import { Offer } from '../src/models/offer.model.js';
import { Order } from '../src/models/order.model.js';
import { Partner } from '../src/models/partner.model.js';
import { User } from '../src/models/user.model.js';
import { runOfferMaintenance } from '../src/services/offer-maintenance.service.js';

const CONFIRM_FLAG = '--confirm-dev-db';

function assertExplicitConfirmation() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    console.error(
      `Refusing to create rehearsal fixtures without ${CONFIRM_FLAG}.\n` +
        `Run: npm run hardening:restart-offer -- ${CONFIRM_FLAG}`,
    );
    process.exit(2);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run restart rehearsal with NODE_ENV=production.');
    process.exit(2);
  }
}

function point(longitude, latitude) {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

async function main() {
  assertExplicitConfirmation();
  await connectDatabase();

  const tag = `restart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ids = {
    userIds: [],
    partnerId: null,
    orderId: null,
    attemptId: null,
    offerId: null,
  };

  try {
    const customer = await User.create({
      name: 'Restart Rehearsal Customer',
      email: `${tag}_customer@example.test`,
      phone: `+91${String(Date.now()).slice(-10)}`,
      passwordHash: 'restart-rehearsal-not-a-login-password',
      emailVerified: true,
      phoneVerified: true,
    });
    ids.userIds.push(customer._id);

    const partnerUser = await User.create({
      name: 'Restart Rehearsal Partner',
      email: `${tag}_partner@example.test`,
      phone: `+92${String(Date.now()).slice(-10)}`,
      passwordHash: 'restart-rehearsal-not-a-login-password',
      emailVerified: true,
      phoneVerified: true,
    });
    ids.userIds.push(partnerUser._id);

    const baseNow = new Date();
    const partner = await Partner.create({
      userId: partnerUser._id,
      verificationStatus: PARTNER_VERIFICATION_STATUS.APPROVED,
      profilePhotoAssetId: new mongoose.Types.ObjectId(),
      collegeIdentity: {
        enrollmentNumber: tag,
        collegeName: 'RouteBite Restart Fixture',
        documentAssetId: new mongoose.Types.ObjectId(),
      },
      availabilityStatus: PARTNER_AVAILABILITY_STATUS.AVAILABLE_NOW,
      currentLocation: point(85.54828, 26.54092),
      locationAccuracyMeters: 5,
      locationUpdatedAt: baseNow,
    });
    ids.partnerId = partner._id;

    const order = await Order.create({
      customerId: customer._id,
      status: ORDER_STATUS.MATCHING,
      vendorDisplayName: 'Restart Rehearsal Vendor',
      requestedItems: 'One persisted pending-offer rehearsal item',
      pickup: point(85.54828, 26.54092),
      pickupText: 'Restart pickup',
      drop: point(85.552, 26.545),
      dropText: 'Restart drop',
      deliveryType: DELIVERY_TYPE.ASAP,
      deliveryWindowStart: baseNow,
      deliveryWindowEnd: new Date(baseNow.getTime() + 45 * 60 * 1000),
      pricing: {
        estimatedFoodCostPaise: 10000,
        customerDeliveryChargePaise: 4000,
        partnerBaseEarningPaise: 4000,
        platformFeePaise: 1000,
        estimatedCustomerTotalPaise: 15000,
      },
    });
    ids.orderId = order._id;

    const predictedPickupAt = new Date(baseNow.getTime() + 5 * 60 * 1000);
    const predictedDeliveryAt = new Date(baseNow.getTime() + 15 * 60 * 1000);
    const candidate = {
      partnerId: partner._id,
      mode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
      routeSource: 'PHASE_15_RESTART_REHEARSAL',
      predictedPickupAt,
      predictedDeliveryAt,
      pickupTravelSeconds: 300,
      totalDeliveryTravelSeconds: 900,
      additionalDetourSeconds: null,
      additionalDetourMeters: null,
      pickupDistanceMeters: 10,
      ratingAverage: 0,
      completedOrderCount: 0,
      rankPosition: 1,
    };

    const attempt = await MatchingAttempt.create({
      orderId: order._id,
      attemptNumber: 1,
      status: MATCHING_ATTEMPT_STATUS.CANDIDATES_READY,
      discoveredCandidateCount: 1,
      eligibleCandidateCount: 1,
      candidates: [candidate],
      offerReadyPartnerIds: [partner._id],
      routeSource: 'PHASE_15_RESTART_REHEARSAL',
    });
    ids.attemptId = attempt._id;

    const expiresAt = new Date(baseNow.getTime() + 30 * 1000);
    const offer = await Offer.create({
      matchingAttemptId: attempt._id,
      orderId: order._id,
      partnerId: partner._id,
      partnerMode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
      round: 1,
      rankPosition: 1,
      status: OFFER_STATUS.PENDING,
      expiresAt,
      predictedPickupAt,
      predictedDeliveryAt,
      expectedEarningPaise: 4000,
    });
    ids.offerId = offer._id;

    console.log('Simulating server startup while the persisted offer is still valid...');
    await runOfferMaintenance(baseNow);

    const stillPending = await Offer.findById(offer._id).lean();
    const stillMatching = await Order.findById(order._id).lean();

    if (
      stillPending?.status !== OFFER_STATUS.PENDING ||
      stillMatching?.status !== ORDER_STATUS.MATCHING
    ) {
      throw new Error('Restart invariant failed: a still-valid persisted offer was not preserved.');
    }

    console.log('PASS 1: valid pending offer survived restart maintenance.');

    const afterExpiry = new Date(expiresAt.getTime() + 1000);
    console.log('Simulating the next maintenance scan after the persisted expiry...');
    await runOfferMaintenance(afterExpiry);

    const expiredOffer = await Offer.findById(offer._id).lean();
    const finalOrder = await Order.findById(order._id).lean();
    const finalAttempt = await MatchingAttempt.findById(attempt._id).lean();

    const passed =
      expiredOffer?.status === OFFER_STATUS.EXPIRED &&
      finalOrder?.status === ORDER_STATUS.MATCHING_FAILED &&
      finalAttempt?.status === MATCHING_ATTEMPT_STATUS.NO_CANDIDATES;

    if (!passed) {
      throw new Error(
        `Restart expiry invariant failed: offer=${expiredOffer?.status}, order=${finalOrder?.status}, attempt=${finalAttempt?.status}`,
      );
    }

    console.log('PASS 2: expired persisted offer advanced to explicit MATCHING_FAILED without DB editing.');
    console.log('\nPASS: server restart / pending-offer persistence rehearsal succeeded.');
  } finally {
    if (ids.offerId) await Offer.deleteOne({ _id: ids.offerId });
    if (ids.attemptId) await MatchingAttempt.deleteOne({ _id: ids.attemptId });
    if (ids.orderId) await Order.deleteOne({ _id: ids.orderId });
    if (ids.partnerId) await Partner.deleteOne({ _id: ids.partnerId });
    if (ids.userIds.length) await User.deleteMany({ _id: { $in: ids.userIds } });
    await mongoose.connection.close();
    console.log('Restart rehearsal fixtures cleaned up.');
  }
}

main().catch(async (error) => {
  console.error('Pending-offer restart rehearsal failed:', error);
  if (mongoose.connection.readyState !== 0) await mongoose.connection.close();
  process.exitCode = 1;
});
