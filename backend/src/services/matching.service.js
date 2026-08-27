import {
  MATCHING_ATTEMPT_STATUS,
  MATCHING_LIMITS,
  MATCHING_PARTNER_MODE,
  MATCHING_REJECTION_REASON,
} from '../constants/matching.constants.js';
import { ORDER_STATUS, DELIVERY_TYPE } from '../constants/order.constants.js';
import {
  PARTNER_AVAILABILITY_STATUS,
  PARTNER_OPERATION_LIMITS,
  PARTNER_VERIFICATION_STATUS,
  TRIP_STATUS,
} from '../constants/partner.constants.js';
import { PAYMENT_STATUS } from '../constants/payment.constants.js';
import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { Payment } from '../models/payment.model.js';
import { Trip } from '../models/trip.model.js';
import { AppError } from '../utils/app-error.js';
import {
  geoPointToLatLng,
  haversineMeters,
  projectPointOnSegment,
} from './matching-geometry.service.js';
import { estimateRoute } from './route-estimate.service.js';

const WAIT_SECONDS = MATCHING_LIMITS.DEFAULT_VENDOR_WAIT_MINUTES * 60;
const EARLY_TOLERANCE_MS = MATCHING_LIMITS.EARLY_DELIVERY_TOLERANCE_MINUTES * 60 * 1000;

function incrementReason(summary, reason) {
  summary[reason] = (summary[reason] ?? 0) + 1;
}

function locationIsFresh(partner, now) {
  if (!partner.currentLocation || !partner.locationUpdatedAt) return false;
  const ageMs = now.getTime() - new Date(partner.locationUpdatedAt).getTime();
  return ageMs >= 0 && ageMs <= PARTNER_OPERATION_LIMITS.MAX_LOCATION_AGE_SECONDS * 1000;
}

function customerWindowAllows(order, predictedDeliveryAt) {
  if (predictedDeliveryAt.getTime() > new Date(order.deliveryWindowEnd).getTime()) {
    return MATCHING_REJECTION_REASON.DELIVERY_WINDOW_MISSED;
  }

  if (
    order.deliveryType === DELIVERY_TYPE.SCHEDULED &&
    predictedDeliveryAt.getTime() < new Date(order.deliveryWindowStart).getTime() - EARLY_TOLERANCE_MS
  ) {
    return MATCHING_REJECTION_REASON.DELIVERY_TOO_EARLY;
  }

  return null;
}

function partnerBaseReason({ partner, order, requireFreshLocation, now }) {
  if (partner.verificationStatus !== PARTNER_VERIFICATION_STATUS.APPROVED) {
    return MATCHING_REJECTION_REASON.PARTNER_NOT_VERIFIED;
  }
  if (partner.userId.toString() === order.customerId.toString()) {
    return MATCHING_REJECTION_REASON.SELF_DELIVERY_NOT_ALLOWED;
  }
  if (partner.activeOrderId) {
    return MATCHING_REJECTION_REASON.PARTNER_BUSY;
  }
  if (requireFreshLocation && !locationIsFresh(partner, now)) {
    return MATCHING_REJECTION_REASON.STALE_LOCATION;
  }
  return null;
}

export function evaluateTripGeometry({ trip, currentLocation = null, pickup, drop }) {
  const origin = geoPointToLatLng(trip.origin);
  const destination = geoPointToLatLng(trip.destination);
  const pickupProjection = projectPointOnSegment(pickup, origin, destination);
  const dropProjection = projectPointOnSegment(drop, origin, destination);

  if (
    pickupProjection.distanceMeters > MATCHING_LIMITS.TRIP_CORRIDOR_METERS ||
    dropProjection.distanceMeters > MATCHING_LIMITS.TRIP_CORRIDOR_METERS
  ) {
    return { eligible: false, reason: MATCHING_REJECTION_REASON.PICKUP_TOO_FAR };
  }

  if (pickupProjection.progress >= dropProjection.progress) {
    return { eligible: false, reason: MATCHING_REJECTION_REASON.WRONG_ROUTE_DIRECTION };
  }

  if (trip.status === TRIP_STATUS.ACTIVE && currentLocation) {
    const currentProjection = projectPointOnSegment(currentLocation, origin, destination);
    if (
      currentProjection.progress >
      pickupProjection.progress + MATCHING_LIMITS.ACTIVE_TRIP_PROGRESS_TOLERANCE
    ) {
      return { eligible: false, reason: MATCHING_REJECTION_REASON.PICKUP_ALREADY_PASSED };
    }
  }

  return {
    eligible: true,
    pickupProgress: pickupProjection.progress,
    dropProgress: dropProjection.progress,
  };
}

async function assertOrderMatchable(orderId) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }

  if (order.status !== ORDER_STATUS.MATCHING || order.assignedPartnerId) {
    throw new AppError('Order is not currently matchable.', {
      statusCode: 409,
      code: 'ORDER_NOT_MATCHABLE',
    });
  }

  const confirmedPayment = await Payment.exists({
    orderId: order._id,
    customerId: order.customerId,
    status: PAYMENT_STATUS.CONFIRMED,
  });

  if (!confirmedPayment) {
    throw new AppError('Matching requires a backend-confirmed payment.', {
      statusCode: 409,
      code: 'PAYMENT_NOT_CONFIRMED',
    });
  }

  return order;
}

async function discoverAvailableNow(order, now) {
  const cutoff = new Date(
    now.getTime() - PARTNER_OPERATION_LIMITS.MAX_LOCATION_AGE_SECONDS * 1000,
  );

  return Partner.find({
    verificationStatus: PARTNER_VERIFICATION_STATUS.APPROVED,
    availabilityStatus: PARTNER_AVAILABILITY_STATUS.AVAILABLE_NOW,
    activeOrderId: null,
    locationUpdatedAt: { $gte: cutoff },
    currentLocation: {
      $near: {
        $geometry: order.pickup,
        $maxDistance: MATCHING_LIMITS.AVAILABLE_NOW_INITIAL_RADIUS_METERS,
      },
    },
  }).limit(MATCHING_LIMITS.AVAILABLE_NOW_DISCOVERY_LIMIT);
}

async function discoverTrips(order, now) {
  const scheduledUpperBound = new Date(
    new Date(order.deliveryWindowEnd).getTime() +
      PARTNER_OPERATION_LIMITS.MAX_DEPARTURE_FLEX_MINUTES * 60 * 1000,
  );

  const trips = await Trip.find({
    $or: [
      { status: TRIP_STATUS.ACTIVE },
      {
        status: TRIP_STATUS.SCHEDULED,
        scheduledDepartureAt: { $lte: scheduledUpperBound },
      },
    ],
  })
    .sort({ scheduledDepartureAt: 1 })
    .limit(MATCHING_LIMITS.TRIP_DISCOVERY_LIMIT);

  const partnerIds = [...new Set(trips.map((trip) => trip.partnerId.toString()))];
  const partners = await Partner.find({ _id: { $in: partnerIds } });
  const partnerMap = new Map(partners.map((partner) => [partner._id.toString(), partner]));

  return trips
    .map((trip) => ({ trip, partner: partnerMap.get(trip.partnerId.toString()) }))
    .filter((entry) => entry.partner);
}

async function refineAvailableCandidate({ partner, order, now }) {
  const baseReason = partnerBaseReason({
    partner,
    order,
    requireFreshLocation: true,
    now,
  });
  if (baseReason) return { rejected: baseReason };

  if (partner.availabilityStatus !== PARTNER_AVAILABILITY_STATUS.AVAILABLE_NOW) {
    return { rejected: MATCHING_REJECTION_REASON.PARTNER_OFFLINE };
  }

  const start = geoPointToLatLng(partner.currentLocation);
  const pickup = geoPointToLatLng(order.pickup);
  const drop = geoPointToLatLng(order.drop);

  const pickupRoute = await estimateRoute([start, pickup]);
  const deliveryRoute = await estimateRoute([pickup, drop]);
  const predictedPickupAt = new Date(now.getTime() + pickupRoute.durationSeconds * 1000);
  const predictedDeliveryAt = new Date(
    predictedPickupAt.getTime() + (WAIT_SECONDS + deliveryRoute.durationSeconds) * 1000,
  );

  const windowReason = customerWindowAllows(order, predictedDeliveryAt);
  if (windowReason) return { rejected: windowReason };

  return {
    candidate: {
      partnerId: partner._id,
      tripId: null,
      mode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
      routeSource:
        pickupRoute.source === deliveryRoute.source ? pickupRoute.source : 'MIXED',
      predictedPickupAt,
      predictedDeliveryAt,
      pickupTravelSeconds: pickupRoute.durationSeconds,
      totalDeliveryTravelSeconds:
        pickupRoute.durationSeconds + WAIT_SECONDS + deliveryRoute.durationSeconds,
      additionalDetourSeconds: null,
      additionalDetourMeters: null,
      pickupDistanceMeters: pickupRoute.distanceMeters,
      ratingAverage: partner.ratingAverage ?? 0,
      completedOrderCount: partner.completedOrderCount ?? 0,
    },
  };
}

function selectScheduledDeparture({ trip, order, routeSecondsToDelivery, now }) {
  const flexMs = trip.departureFlexMinutes * 60 * 1000;
  const scheduledMs = new Date(trip.scheduledDepartureAt).getTime();
  const earliest = Math.max(now.getTime(), scheduledMs - flexMs);
  const latest = scheduledMs + flexMs;

  if (earliest > latest) return null;

  if (order.deliveryType === DELIVERY_TYPE.ASAP) return new Date(earliest);

  const desired = new Date(order.deliveryWindowStart).getTime() - routeSecondsToDelivery * 1000;
  return new Date(Math.max(earliest, Math.min(latest, desired)));
}

async function refineTripCandidate({ trip, partner, order, now }) {
  const requireFreshLocation = trip.status === TRIP_STATUS.ACTIVE;
  const baseReason = partnerBaseReason({ partner, order, requireFreshLocation, now });
  if (baseReason) return { rejected: baseReason };

  const pickup = geoPointToLatLng(order.pickup);
  const drop = geoPointToLatLng(order.drop);
  const currentLocation = partner.currentLocation ? geoPointToLatLng(partner.currentLocation) : null;
  const geometry = evaluateTripGeometry({ trip, currentLocation, pickup, drop });
  if (!geometry.eligible) return { rejected: geometry.reason };

  let start;
  let departureAt;

  if (trip.status === TRIP_STATUS.ACTIVE) {
    if (!currentLocation) return { rejected: MATCHING_REJECTION_REASON.STALE_LOCATION };
    start = currentLocation;
    departureAt = now;
  } else {
    start = geoPointToLatLng(trip.origin);
  }

  const destination = geoPointToLatLng(trip.destination);
  const [baseRoute, withOrderRoute, pickupRoute, deliveryRoute] = await Promise.all([
    estimateRoute([start, destination]),
    estimateRoute([start, pickup, drop, destination]),
    estimateRoute([start, pickup]),
    estimateRoute([pickup, drop]),
  ]);

  const detourSeconds = Math.max(0, withOrderRoute.durationSeconds - baseRoute.durationSeconds);
  const detourMeters = Math.max(0, withOrderRoute.distanceMeters - baseRoute.distanceMeters);

  if (
    detourSeconds > MATCHING_LIMITS.MAX_ROUTE_DETOUR_MINUTES * 60 ||
    detourMeters > MATCHING_LIMITS.MAX_ROUTE_DETOUR_METERS
  ) {
    return { rejected: MATCHING_REJECTION_REASON.DETOUR_TOO_HIGH };
  }

  const routeSecondsToDelivery = pickupRoute.durationSeconds + WAIT_SECONDS + deliveryRoute.durationSeconds;

  if (trip.status === TRIP_STATUS.SCHEDULED) {
    departureAt = selectScheduledDeparture({ trip, order, routeSecondsToDelivery, now });
    if (!departureAt) return { rejected: MATCHING_REJECTION_REASON.TRIP_TIME_INCOMPATIBLE };
  }

  const predictedPickupAt = new Date(
    departureAt.getTime() + pickupRoute.durationSeconds * 1000,
  );
  const predictedDeliveryAt = new Date(
    departureAt.getTime() + routeSecondsToDelivery * 1000,
  );
  const windowReason = customerWindowAllows(order, predictedDeliveryAt);
  if (windowReason) return { rejected: windowReason };

  const sources = new Set([
    baseRoute.source,
    withOrderRoute.source,
    pickupRoute.source,
    deliveryRoute.source,
  ]);

  return {
    candidate: {
      partnerId: partner._id,
      tripId: trip._id,
      mode:
        trip.status === TRIP_STATUS.ACTIVE
          ? MATCHING_PARTNER_MODE.TRIP_ACTIVE
          : MATCHING_PARTNER_MODE.TRIP_SCHEDULED,
      routeSource: sources.size === 1 ? [...sources][0] : 'MIXED',
      predictedPickupAt,
      predictedDeliveryAt,
      pickupTravelSeconds: pickupRoute.durationSeconds,
      totalDeliveryTravelSeconds: routeSecondsToDelivery,
      additionalDetourSeconds: detourSeconds,
      additionalDetourMeters: detourMeters,
      pickupDistanceMeters: pickupRoute.distanceMeters,
      ratingAverage: partner.ratingAverage ?? 0,
      completedOrderCount: partner.completedOrderCount ?? 0,
    },
  };
}

export function rankCandidates(candidates) {
  return [...candidates]
    .sort((a, b) => {
      const deliveryDiff =
        new Date(a.predictedDeliveryAt).getTime() - new Date(b.predictedDeliveryAt).getTime();
      if (Math.abs(deliveryDiff) > 60 * 1000) return deliveryDiff;

      const aOnWay = a.mode === MATCHING_PARTNER_MODE.AVAILABLE_NOW ? 1 : 0;
      const bOnWay = b.mode === MATCHING_PARTNER_MODE.AVAILABLE_NOW ? 1 : 0;
      if (aOnWay !== bOnWay) return aOnWay - bOnWay;

      const aDetour = a.additionalDetourSeconds ?? Number.POSITIVE_INFINITY;
      const bDetour = b.additionalDetourSeconds ?? Number.POSITIVE_INFINITY;
      if (aDetour !== bDetour) return aDetour - bDetour;
      if (a.pickupTravelSeconds !== b.pickupTravelSeconds) {
        return a.pickupTravelSeconds - b.pickupTravelSeconds;
      }
      if (a.completedOrderCount !== b.completedOrderCount) {
        return b.completedOrderCount - a.completedOrderCount;
      }
      if (a.ratingAverage !== b.ratingAverage) return b.ratingAverage - a.ratingAverage;
      return a.partnerId.toString().localeCompare(b.partnerId.toString());
    })
    .map((candidate, index) => ({ ...candidate, rankPosition: index + 1 }));
}

function safeAttempt(attempt) {
  if (!attempt) return null;
  return {
    id: attempt._id.toString(),
    orderId: attempt.orderId.toString(),
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    routeSource: attempt.routeSource,
    discoveredCandidateCount: attempt.discoveredCandidateCount,
    eligibleCandidateCount: attempt.eligibleCandidateCount,
    offerReadyPartnerIds: attempt.offerReadyPartnerIds.map((id) => id.toString()),
    candidates: attempt.candidates.map((candidate) => ({
      partnerId: candidate.partnerId.toString(),
      tripId: candidate.tripId?.toString() ?? null,
      mode: candidate.mode,
      routeSource: candidate.routeSource,
      predictedPickupAt: candidate.predictedPickupAt,
      predictedDeliveryAt: candidate.predictedDeliveryAt,
      pickupTravelSeconds: candidate.pickupTravelSeconds,
      additionalDetourSeconds: candidate.additionalDetourSeconds,
      additionalDetourMeters: candidate.additionalDetourMeters,
      rankPosition: candidate.rankPosition,
    })),
    rejectionSummary: attempt.rejectionSummary ?? {},
    failureReason: attempt.failureReason,
    completedAt: attempt.completedAt,
  };
}

export async function runMatchingForOrder(orderId, now = new Date()) {
  const order = await assertOrderMatchable(orderId);

  const existingCompleted = await MatchingAttempt.findOne({
    orderId: order._id,
    status: { $in: [MATCHING_ATTEMPT_STATUS.CANDIDATES_READY, MATCHING_ATTEMPT_STATUS.NO_CANDIDATES] },
  }).sort({ attemptNumber: -1 });
  if (existingCompleted) return safeAttempt(existingCompleted);

  const running = await MatchingAttempt.findOne({
    orderId: order._id,
    status: MATCHING_ATTEMPT_STATUS.RUNNING,
  });
  if (running) return safeAttempt(running);

  const latest = await MatchingAttempt.findOne({ orderId: order._id }).sort({ attemptNumber: -1 });
  let attempt;
  try {
    attempt = await MatchingAttempt.create({
      orderId: order._id,
      attemptNumber: (latest?.attemptNumber ?? 0) + 1,
      status: MATCHING_ATTEMPT_STATUS.RUNNING,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const concurrent = await MatchingAttempt.findOne({
        orderId: order._id,
        status: MATCHING_ATTEMPT_STATUS.RUNNING,
      });
      if (concurrent) return safeAttempt(concurrent);
    }
    throw error;
  }

  const rejectionSummary = {};

  try {
    const [availablePartners, tripEntries] = await Promise.all([
      discoverAvailableNow(order, now),
      discoverTrips(order, now),
    ]);

    const rawCandidates = [
      ...availablePartners.map((partner) => ({ type: 'AVAILABLE', partner })),
      ...tripEntries.map(({ trip, partner }) => ({ type: 'TRIP', trip, partner })),
    ];

    const shortlist = rawCandidates.slice(0, MATCHING_LIMITS.ROUTE_SHORTLIST_LIMIT);
    const eligible = [];

    for (const entry of shortlist) {
      try {
        const result =
          entry.type === 'AVAILABLE'
            ? await refineAvailableCandidate({ partner: entry.partner, order, now })
            : await refineTripCandidate({
                trip: entry.trip,
                partner: entry.partner,
                order,
                now,
              });

        if (result.candidate) eligible.push(result.candidate);
        else incrementReason(rejectionSummary, result.rejected);
      } catch (error) {
        incrementReason(rejectionSummary, MATCHING_REJECTION_REASON.NO_ROUTE_AVAILABLE);
      }
    }

    const ranked = rankCandidates(eligible);
    const offerReady = ranked.slice(0, MATCHING_LIMITS.OFFER_BATCH_SIZE);

    if (ranked.length === 0) {
      await MatchingAttempt.updateOne(
        { _id: attempt._id, status: MATCHING_ATTEMPT_STATUS.RUNNING },
        {
          $set: {
            status: MATCHING_ATTEMPT_STATUS.NO_CANDIDATES,
            discoveredCandidateCount: rawCandidates.length,
            eligibleCandidateCount: 0,
            rejectionSummary,
            failureReason: 'No eligible partner can satisfy this request right now.',
            completedAt: new Date(),
          },
        },
      );

      await Order.updateOne(
        { _id: order._id, status: ORDER_STATUS.MATCHING, assignedPartnerId: null },
        { $set: { status: ORDER_STATUS.MATCHING_FAILED } },
      );
    } else {
      const routeSources = new Set(ranked.map((candidate) => candidate.routeSource));
      await MatchingAttempt.updateOne(
        { _id: attempt._id, status: MATCHING_ATTEMPT_STATUS.RUNNING },
        {
          $set: {
            status: MATCHING_ATTEMPT_STATUS.CANDIDATES_READY,
            routeSource: routeSources.size === 1 ? [...routeSources][0] : 'MIXED',
            discoveredCandidateCount: rawCandidates.length,
            eligibleCandidateCount: ranked.length,
            candidates: ranked,
            offerReadyPartnerIds: offerReady.map((candidate) => candidate.partnerId),
            rejectionSummary,
            completedAt: new Date(),
          },
        },
      );
    }

    const completed = await MatchingAttempt.findById(attempt._id);
    return safeAttempt(completed);
  } catch (error) {
    await MatchingAttempt.updateOne(
      { _id: attempt._id, status: MATCHING_ATTEMPT_STATUS.RUNNING },
      {
        $set: {
          status: MATCHING_ATTEMPT_STATUS.FAILED,
          failureReason: error.message,
          completedAt: new Date(),
        },
      },
    );
    throw error;
  }
}

export async function getCustomerMatchingState({ customerId, orderId }) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) {
    throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }

  const attempt = await MatchingAttempt.findOne({ orderId: order._id }).sort({ attemptNumber: -1 });
  return {
    orderStatus: order.status,
    matching: safeAttempt(attempt),
  };
}
