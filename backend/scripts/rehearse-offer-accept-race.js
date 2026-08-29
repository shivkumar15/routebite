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
import { acceptOffer } from '../src/services/offer.service.js';

const CONFIRM_FLAG = '--confirm-dev-db';

function assertExplicitConfirmation() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    console.error(
      `Refusing to create rehearsal fixtures without ${CONFIRM_FLAG}.\n` +
        `Run: npm run hardening:accept-race -- ${CONFIRM_FLAG}`,
    );
    process.exit(2);
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run the hardening race rehearsal with NODE_ENV=production.');
    process.exit(2);
  }
}

function point(longitude, latitude) {
  return { type: 'Point', coordinates: [longitude, latitude] };
}

async function main() {
  assertExplicitConfirmation();
  await connectDatabase();

  const tag = `hardening_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ids = {
    userIds: [],
    partnerIds: [],
    orderId: null,
    attemptId: null,
    offerIds: [],
  };

  try {
    const customer = await User.create({
      name: 'Hardening Customer',
      email: `${tag}_customer@example.test`,
      phone: `+91${String(Date.now()).slice(-10)}`,
      passwordHash: 'hardening-fixture-not-a-login-password',
      emailVerified: true,
      phoneVerified: true,
    });
    ids.userIds.push(customer._id);

    const partnerUsers = [];
    for (let i = 0; i < 2; i += 1) {
      const user = await User.create({
        name: `Hardening Partner ${i + 1}`,
        email: `${tag}_partner_${i + 1}@example.test`,
        phone: `+92${String(Date.now() + i).slice(-10)}`,
        passwordHash: 'hardening-fixture-not-a-login-password',
        emailVerified: true,
        phoneVerified: true,
      });
      ids.userIds.push(user._id);
      partnerUsers.push(user);
    }

    const now = new Date();
    const partners = [];
    for (let i = 0; i < partnerUsers.length; i += 1) {
      const partner = await Partner.create({
        userId: partnerUsers[i]._id,
        verificationStatus: PARTNER_VERIFICATION_STATUS.APPROVED,
        profilePhotoAssetId: new mongoose.Types.ObjectId(),
        collegeIdentity: {
          enrollmentNumber: `${tag}-${i + 1}`,
          collegeName: 'RouteBite Hardening Fixture',
          documentAssetId: new mongoose.Types.ObjectId(),
        },
        availabilityStatus: PARTNER_AVAILABILITY_STATUS.AVAILABLE_NOW,
        currentLocation: point(85.54828 + i * 0.00001, 26.54092 + i * 0.00001),
        locationAccuracyMeters: 5,
        locationUpdatedAt: now,
      });
      ids.partnerIds.push(partner._id);
      partners.push(partner);
    }

    const order = await Order.create({
      customerId: customer._id,
      status: ORDER_STATUS.MATCHING,
      vendorDisplayName: 'Hardening Race Vendor',
      requestedItems: 'One isolated concurrency rehearsal item',
      pickup: point(85.54828, 26.54092),
      pickupText: 'Hardening pickup',
      drop: point(85.552, 26.545),
      dropText: 'Hardening drop',
      deliveryType: DELIVERY_TYPE.ASAP,
      deliveryWindowStart: now,
      deliveryWindowEnd: new Date(now.getTime() + 45 * 60 * 1000),
      pricing: {
        estimatedFoodCostPaise: 10000,
        customerDeliveryChargePaise: 4000,
        partnerBaseEarningPaise: 4000,
        platformFeePaise: 1000,
        estimatedCustomerTotalPaise: 15000,
      },
    });
    ids.orderId = order._id;

    const predictedPickupAt = new Date(now.getTime() + 5 * 60 * 1000);
    const predictedDeliveryAt = new Date(now.getTime() + 15 * 60 * 1000);
    const candidates = partners.map((partner, index) => ({
      partnerId: partner._id,
      mode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
      routeSource: 'PHASE_15_REHEARSAL',
      predictedPickupAt,
      predictedDeliveryAt,
      pickupTravelSeconds: 300,
      totalDeliveryTravelSeconds: 900,
      additionalDetourSeconds: null,
      additionalDetourMeters: null,
      pickupDistanceMeters: 10 + index,
      ratingAverage: 0,
      completedOrderCount: 0,
      rankPosition: index + 1,
    }));

    const attempt = await MatchingAttempt.create({
      orderId: order._id,
      attemptNumber: 1,
      status: MATCHING_ATTEMPT_STATUS.CANDIDATES_READY,
      discoveredCandidateCount: 2,
      eligibleCandidateCount: 2,
      candidates,
      offerReadyPartnerIds: partners.map((partner) => partner._id),
      routeSource: 'PHASE_15_REHEARSAL',
    });
    ids.attemptId = attempt._id;

    const expiresAt = new Date(now.getTime() + 2 * 60 * 1000);
    const offers = [];
    for (let i = 0; i < partners.length; i += 1) {
      const offer = await Offer.create({
        matchingAttemptId: attempt._id,
        orderId: order._id,
        partnerId: partners[i]._id,
        partnerMode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
        round: 1,
        rankPosition: i + 1,
        status: OFFER_STATUS.PENDING,
        expiresAt,
        predictedPickupAt,
        predictedDeliveryAt,
        expectedEarningPaise: 4000,
      });
      ids.offerIds.push(offer._id);
      offers.push(offer);
    }

    console.log('Created isolated race fixtures. Firing two accepts concurrently...');
    const results = await Promise.allSettled([
      acceptOffer({ offerId: offers[0]._id, partnerId: partners[0]._id }, new Date()),
      acceptOffer({ offerId: offers[1]._id, partnerId: partners[1]._id }, new Date()),
    ]);

    const refreshedOrder = await Order.findById(order._id).lean();
    const refreshedOffers = await Offer.find({ orderId: order._id }).sort({ rankPosition: 1 }).lean();
    const refreshedPartners = await Partner.find({ _id: { $in: partners.map((p) => p._id) } }).lean();

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    const acceptedOffers = refreshedOffers.filter((offer) => offer.status === OFFER_STATUS.ACCEPTED);
    const activePartners = refreshedPartners.filter(
      (partner) => partner.activeOrderId?.toString() === order._id.toString(),
    );

    console.log('\nRace result');
    console.table(
      results.map((result, index) => ({
        partner: index + 1,
        result: result.status,
        code: result.status === 'rejected' ? result.reason?.code ?? result.reason?.message : 'ACCEPTED',
      })),
    );
    console.table(
      refreshedOffers.map((offer, index) => ({
        partner: index + 1,
        offerStatus: offer.status,
      })),
    );

    const passed =
      fulfilled.length === 1 &&
      rejected.length === 1 &&
      refreshedOrder?.status === ORDER_STATUS.ASSIGNED &&
      Boolean(refreshedOrder?.assignedPartnerId) &&
      acceptedOffers.length === 1 &&
      activePartners.length === 1 &&
      activePartners[0]._id.toString() === refreshedOrder.assignedPartnerId.toString();

    if (!passed) {
      throw new Error(
        'Acceptance race invariant failed: expected exactly one winner, one ACCEPTED offer, and one active partner.',
      );
    }

    console.log('\nPASS: exactly one partner won the same-order acceptance race.');
  } finally {
    if (ids.offerIds.length) await Offer.deleteMany({ _id: { $in: ids.offerIds } });
    if (ids.attemptId) await MatchingAttempt.deleteOne({ _id: ids.attemptId });
    if (ids.orderId) await Order.deleteOne({ _id: ids.orderId });
    if (ids.partnerIds.length) await Partner.deleteMany({ _id: { $in: ids.partnerIds } });
    if (ids.userIds.length) await User.deleteMany({ _id: { $in: ids.userIds } });
    await mongoose.connection.close();
    console.log('Hardening fixtures cleaned up.');
  }
}

main().catch((error) => {
  console.error('Offer acceptance race rehearsal failed:', error);
  process.exitCode = 1;
});
