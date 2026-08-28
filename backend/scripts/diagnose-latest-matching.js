import mongoose from 'mongoose';
import { connectDatabase } from '../src/config/db.js';
import { PARTNER_OPERATION_LIMITS } from '../src/constants/partner.constants.js';
import { MatchingAttempt } from '../src/models/matching-attempt.model.js';
import { Offer } from '../src/models/offer.model.js';
import { Order } from '../src/models/order.model.js';
import { Partner } from '../src/models/partner.model.js';
import { User } from '../src/models/user.model.js';

const email = process.argv[2]?.trim().toLowerCase() || null;
const now = new Date();

function shortId(value) {
  if (!value) return null;
  return value.toString().slice(-6).toUpperCase();
}

function ageSeconds(value) {
  if (!value) return null;
  return Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 1000));
}

function summarizeOffers(offers) {
  return offers.map((offer) => ({
    id: shortId(offer._id),
    partner: shortId(offer.partnerId),
    status: offer.status,
    round: offer.round,
    rank: offer.rankPosition,
    createdAt: offer.createdAt,
    expiresAt: offer.expiresAt,
    respondedAt: offer.respondedAt,
  }));
}

function diagnosisFor({ order, attempt, offers }) {
  if (order.status === 'MATCHING_FAILED') {
    if (offers.length > 0 && offers.every((offer) => offer.status === 'EXPIRED')) {
      return 'Offers were successfully dispatched, but every offer expired before acceptance.';
    }
    if (offers.some((offer) => offer.status === 'REJECTED')) {
      return 'At least one eligible partner explicitly rejected the offer and no later candidate succeeded.';
    }
    if ((attempt?.eligibleCandidateCount ?? 0) === 0) {
      return `No eligible candidate survived matching. Rejections: ${JSON.stringify(attempt?.rejectionSummary ?? {})}`;
    }
    return attempt?.failureReason || 'Matching failed after candidate/offer processing.';
  }

  if (order.status === 'MATCHING' && offers.some((offer) => offer.status === 'PENDING')) {
    return 'Matching is healthy and at least one partner offer is currently pending.';
  }

  if (order.status === 'ASSIGNED') {
    return 'A partner accepted successfully; matching is not the problem for this order.';
  }

  return `Order is currently ${order.status}.`;
}

try {
  await connectDatabase();

  let customerId = null;
  if (email) {
    const user = await User.findOne({ email }).select('_id email').lean();
    if (!user) {
      console.error(`No RouteBite user found with email ${email}`);
      process.exitCode = 1;
    } else {
      customerId = user._id;
      console.log(`\nMatching diagnostics for customer: ${user.email}`);
    }
  } else {
    console.log('\nMatching diagnostics for the latest 5 orders in this development database.');
    console.log('Tip: pass a customer email to scope results: npm run matching:diagnose -- user@example.com');
  }

  if (process.exitCode !== 1) {
    const orderFilter = customerId ? { customerId } : {};
    const orders = await Order.find(orderFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    if (orders.length === 0) {
      console.log('No orders found.');
    }

    for (const order of orders) {
      const [attempt, offers] = await Promise.all([
        MatchingAttempt.findOne({ orderId: order._id }).sort({ attemptNumber: -1 }).lean(),
        Offer.find({ orderId: order._id }).sort({ createdAt: 1 }).lean(),
      ]);

      console.log('\n------------------------------------------------------------');
      console.log(`Order #${shortId(order._id)} · ${order.vendorDisplayName}`);
      console.log({
        status: order.status,
        createdAt: order.createdAt,
        pickup: order.pickupText,
        drop: order.dropText,
        assignedPartner: shortId(order.assignedPartnerId),
        recoveryEvent: order.recovery?.lastEvent ?? null,
      });

      console.log('Matching attempt:');
      console.log(
        attempt
          ? {
              attemptNumber: attempt.attemptNumber,
              status: attempt.status,
              discoveredCandidateCount: attempt.discoveredCandidateCount,
              eligibleCandidateCount: attempt.eligibleCandidateCount,
              offerReadyCount: attempt.offerReadyPartnerIds?.length ?? 0,
              rejectionSummary: attempt.rejectionSummary ?? {},
              failureReason: attempt.failureReason,
              completedAt: attempt.completedAt,
            }
          : null,
      );

      console.log('Offers:');
      console.table(summarizeOffers(offers));
      console.log(`DIAGNOSIS: ${diagnosisFor({ order, attempt, offers })}`);
    }

    const partners = await Partner.find({ verificationStatus: 'APPROVED' })
      .select('_id availabilityStatus activeOrderId locationUpdatedAt locationAccuracyMeters')
      .sort({ updatedAt: -1 })
      .lean();

    console.log('\n============================================================');
    console.log('Approved partner supply right now:');
    console.table(
      partners.map((partner) => {
        const locationAgeSeconds = ageSeconds(partner.locationUpdatedAt);
        return {
          partner: shortId(partner._id),
          availability: partner.availabilityStatus,
          activeOrder: shortId(partner.activeOrderId),
          locationAgeSeconds,
          locationFresh:
            locationAgeSeconds != null &&
            locationAgeSeconds <= PARTNER_OPERATION_LIMITS.MAX_LOCATION_AGE_SECONDS,
          accuracyMeters: partner.locationAccuracyMeters,
        };
      }),
    );
  }
} catch (error) {
  console.error('Matching diagnostics failed:', error);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close().catch(() => {});
}
