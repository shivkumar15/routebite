import mongoose from 'mongoose';
import {
  MATCHING_ATTEMPT_STATUS,
  MATCHING_PARTNER_MODE,
} from '../constants/matching.constants.js';
import { OFFER_LIMITS, OFFER_STATUS } from '../constants/offer.constants.js';
import { ORDER_STATUS } from '../constants/order.constants.js';
import {
  PARTNER_AVAILABILITY_STATUS,
  PARTNER_OPERATION_LIMITS,
  PARTNER_VERIFICATION_STATUS,
  TRIP_STATUS,
} from '../constants/partner.constants.js';
import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Offer } from '../models/offer.model.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { Trip } from '../models/trip.model.js';
import { getSocketServer } from '../socket/index.js';
import { AppError } from '../utils/app-error.js';

const DISPATCH_LEASE_MS = 5000;

function locationIsFresh(partner, now) {
  if (!partner.currentLocation || !partner.locationUpdatedAt) return false;
  const ageMs = now.getTime() - new Date(partner.locationUpdatedAt).getTime();
  return ageMs >= 0 && ageMs <= PARTNER_OPERATION_LIMITS.MAX_LOCATION_AGE_SECONDS * 1000;
}

function emitToPartner(partnerId, eventName, payload) {
  getSocketServer()?.to(`partner:${partnerId}`).emit(eventName, payload);
}

function emitToCustomer(customerId, eventName, payload) {
  getSocketServer()?.to(`user:${customerId}`).emit(eventName, payload);
}

function offerCore(offer) {
  return {
    id: offer._id.toString(),
    orderId: offer.orderId.toString(),
    matchingAttemptId: offer.matchingAttemptId.toString(),
    partnerMode: offer.partnerMode,
    tripId: offer.tripId?.toString() ?? null,
    round: offer.round,
    rankPosition: offer.rankPosition,
    status: offer.status,
    expiresAt: offer.expiresAt,
    respondedAt: offer.respondedAt,
    predictedPickupAt: offer.predictedPickupAt,
    predictedDeliveryAt: offer.predictedDeliveryAt,
    additionalDetourSeconds: offer.additionalDetourSeconds,
    additionalDetourMeters: offer.additionalDetourMeters,
    expectedEarningPaise: offer.expectedEarningPaise,
    createdAt: offer.createdAt,
  };
}

async function toPartnerOffer(offer, order = null) {
  const resolvedOrder = order ?? await Order.findById(offer.orderId);
  if (!resolvedOrder) return offerCore(offer);

  return {
    ...offerCore(offer),
    request: {
      vendorDisplayName: resolvedOrder.vendorDisplayName,
      requestedItems: resolvedOrder.requestedItems,
      pickupLabel: resolvedOrder.pickupText,
      dropLabel: resolvedOrder.dropText,
      deliveryType: resolvedOrder.deliveryType,
      deliveryWindowStart: resolvedOrder.deliveryWindowStart,
      deliveryWindowEnd: resolvedOrder.deliveryWindowEnd,
    },
  };
}

async function candidateStillOperational(candidate, now) {
  const partner = await Partner.findById(candidate.partnerId);
  if (
    !partner ||
    partner.verificationStatus !== PARTNER_VERIFICATION_STATUS.APPROVED ||
    partner.activeOrderId
  ) {
    return false;
  }

  if (candidate.mode === MATCHING_PARTNER_MODE.AVAILABLE_NOW) {
    return (
      partner.availabilityStatus === PARTNER_AVAILABILITY_STATUS.AVAILABLE_NOW &&
      locationIsFresh(partner, now)
    );
  }

  if (!candidate.tripId) return false;
  const trip = await Trip.findOne({ _id: candidate.tripId, partnerId: partner._id });
  if (!trip) return false;

  if (candidate.mode === MATCHING_PARTNER_MODE.TRIP_SCHEDULED) {
    return trip.status === TRIP_STATUS.SCHEDULED;
  }

  if (candidate.mode === MATCHING_PARTNER_MODE.TRIP_ACTIVE) {
    return trip.status === TRIP_STATUS.ACTIVE && locationIsFresh(partner, now);
  }

  return false;
}

async function acquireDispatchLease(matchingAttemptId, now) {
  const leaseUntil = new Date(now.getTime() + DISPATCH_LEASE_MS);
  return MatchingAttempt.findOneAndUpdate(
    {
      _id: matchingAttemptId,
      status: MATCHING_ATTEMPT_STATUS.CANDIDATES_READY,
      $or: [
        { dispatchLockUntil: null },
        { dispatchLockUntil: { $exists: false } },
        { dispatchLockUntil: { $lte: now } },
      ],
    },
    { $set: { dispatchLockUntil: leaseUntil } },
    { new: true },
  );
}

async function releaseDispatchLease(matchingAttemptId) {
  await MatchingAttempt.updateOne(
    { _id: matchingAttemptId },
    { $set: { dispatchLockUntil: null } },
  );
}

async function expirePendingForAttempt(matchingAttemptId, now) {
  const stale = await Offer.find({
    matchingAttemptId,
    status: OFFER_STATUS.PENDING,
    expiresAt: { $lte: now },
  });

  if (stale.length === 0) return [];

  const ids = stale.map((offer) => offer._id);
  await Offer.updateMany(
    { _id: { $in: ids }, status: OFFER_STATUS.PENDING },
    { $set: { status: OFFER_STATUS.EXPIRED, respondedAt: now } },
  );

  for (const offer of stale) {
    emitToPartner(offer.partnerId.toString(), 'offer:expired', {
      offerId: offer._id.toString(),
      orderId: offer.orderId.toString(),
    });
  }

  return stale;
}

async function failExhaustedOrder(order, reason) {
  const moved = await Order.findOneAndUpdate(
    { _id: order._id, status: ORDER_STATUS.MATCHING, assignedPartnerId: null },
    { $set: { status: ORDER_STATUS.MATCHING_FAILED } },
    { new: true },
  );

  if (moved) {
    emitToCustomer(order.customerId.toString(), 'matching:failed', {
      orderId: order._id.toString(),
      status: ORDER_STATUS.MATCHING_FAILED,
      reason,
    });
  }

  return moved;
}

export async function dispatchNextOfferBatch(matchingAttemptId, now = new Date()) {
  const leasedAttempt = await acquireDispatchLease(matchingAttemptId, now);
  if (!leasedAttempt) {
    return { dispatched: 0, skipped: true };
  }

  try {
    const order = await Order.findById(leasedAttempt.orderId);
    if (!order || order.status !== ORDER_STATUS.MATCHING || order.assignedPartnerId) {
      return { dispatched: 0, orderClosed: true };
    }

    await expirePendingForAttempt(leasedAttempt._id, now);

    const pendingCount = await Offer.countDocuments({
      matchingAttemptId: leasedAttempt._id,
      status: OFFER_STATUS.PENDING,
      expiresAt: { $gt: now },
    });
    if (pendingCount > 0) return { dispatched: 0, waitingOnCurrentBatch: true };

    const previousOffers = await Offer.find({ matchingAttemptId: leasedAttempt._id })
      .select('partnerId round')
      .sort({ round: -1 });
    const alreadyOffered = new Set(previousOffers.map((offer) => offer.partnerId.toString()));
    const round = (previousOffers[0]?.round ?? 0) + 1;
    const candidates = [...leasedAttempt.candidates].sort(
      (a, b) => a.rankPosition - b.rankPosition,
    );

    const createdOffers = [];
    for (const candidate of candidates) {
      if (createdOffers.length >= 3) break;
      if (alreadyOffered.has(candidate.partnerId.toString())) continue;
      if (!(await candidateStillOperational(candidate, now))) continue;

      const expiresAt = new Date(now.getTime() + OFFER_LIMITS.TIMEOUT_SECONDS * 1000);
      try {
        const offer = await Offer.create({
          matchingAttemptId: leasedAttempt._id,
          orderId: order._id,
          partnerId: candidate.partnerId,
          tripId: candidate.tripId ?? null,
          partnerMode: candidate.mode,
          round,
          rankPosition: candidate.rankPosition,
          status: OFFER_STATUS.PENDING,
          expiresAt,
          predictedPickupAt: candidate.predictedPickupAt,
          predictedDeliveryAt: candidate.predictedDeliveryAt,
          additionalDetourSeconds: candidate.additionalDetourSeconds ?? null,
          additionalDetourMeters: candidate.additionalDetourMeters ?? null,
          expectedEarningPaise: order.pricing.partnerBaseEarningPaise,
        });
        createdOffers.push(offer);
        alreadyOffered.add(candidate.partnerId.toString());
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }

    if (createdOffers.length === 0) {
      await failExhaustedOrder(
        order,
        'All currently eligible offer candidates were exhausted or became unavailable.',
      );
      return { dispatched: 0, exhausted: true };
    }

    for (const offer of createdOffers) {
      const payload = await toPartnerOffer(offer, order);
      emitToPartner(offer.partnerId.toString(), 'offer:new', payload);
    }

    emitToCustomer(order.customerId.toString(), 'matching:offers-dispatched', {
      orderId: order._id.toString(),
      round,
      offerCount: createdOffers.length,
    });

    return {
      dispatched: createdOffers.length,
      round,
      expiresAt: createdOffers[0]?.expiresAt ?? null,
    };
  } finally {
    await releaseDispatchLease(matchingAttemptId);
  }
}

export async function getPartnerActiveOffers(partnerId, now = new Date()) {
  const stale = await Offer.find({
    partnerId,
    status: OFFER_STATUS.PENDING,
    expiresAt: { $lte: now },
  });

  if (stale.length > 0) {
    await Offer.updateMany(
      { _id: { $in: stale.map((offer) => offer._id) }, status: OFFER_STATUS.PENDING },
      { $set: { status: OFFER_STATUS.EXPIRED, respondedAt: now } },
    );
  }

  const offers = await Offer.find({
    partnerId,
    status: OFFER_STATUS.PENDING,
    expiresAt: { $gt: now },
  }).sort({ expiresAt: 1, rankPosition: 1 });

  const result = [];
  for (const offer of offers) result.push(await toPartnerOffer(offer));
  return result;
}

async function resolveUnavailableOffer(offerId, partnerId, now) {
  const offer = await Offer.findOne({ _id: offerId, partnerId });
  if (!offer) {
    throw new AppError('Offer not found.', { statusCode: 404, code: 'OFFER_NOT_FOUND' });
  }

  if (offer.status !== OFFER_STATUS.PENDING) {
    throw new AppError('This offer is no longer available.', {
      statusCode: 409,
      code: 'OFFER_NOT_PENDING',
    });
  }

  if (offer.expiresAt.getTime() <= now.getTime()) {
    await Offer.updateOne(
      { _id: offer._id, status: OFFER_STATUS.PENDING },
      { $set: { status: OFFER_STATUS.EXPIRED, respondedAt: now } },
    );
    await dispatchNextOfferBatch(offer.matchingAttemptId, now);
    throw new AppError('This offer has expired.', {
      statusCode: 409,
      code: 'OFFER_EXPIRED',
    });
  }

  return offer;
}

export async function rejectOffer({ offerId, partnerId }, now = new Date()) {
  await resolveUnavailableOffer(offerId, partnerId, now);

  const offer = await Offer.findOneAndUpdate(
    {
      _id: offerId,
      partnerId,
      status: OFFER_STATUS.PENDING,
      expiresAt: { $gt: now },
    },
    { $set: { status: OFFER_STATUS.REJECTED, respondedAt: now } },
    { new: true },
  );

  if (!offer) {
    throw new AppError('This offer changed before it could be rejected.', {
      statusCode: 409,
      code: 'OFFER_STATE_CONFLICT',
    });
  }

  await dispatchNextOfferBatch(offer.matchingAttemptId, now);
  return toPartnerOffer(offer);
}

export async function acceptOffer({ offerId, partnerId }, now = new Date()) {
  const session = await mongoose.startSession();
  let acceptedOffer = null;
  let assignedOrder = null;
  let losingPartnerIds = [];
  let deferredError = null;
  let matchingAttemptId = null;

  try {
    await session.withTransaction(async () => {
      const offer = await Offer.findOne({ _id: offerId, partnerId }).session(session);
      if (!offer) {
        deferredError = new AppError('Offer not found.', {
          statusCode: 404,
          code: 'OFFER_NOT_FOUND',
        });
        return;
      }
      matchingAttemptId = offer.matchingAttemptId;

      if (offer.status !== OFFER_STATUS.PENDING) {
        deferredError = new AppError('This offer is no longer available.', {
          statusCode: 409,
          code: 'OFFER_NOT_PENDING',
        });
        return;
      }

      if (offer.expiresAt.getTime() <= now.getTime()) {
        await Offer.updateOne(
          { _id: offer._id, status: OFFER_STATUS.PENDING },
          { $set: { status: OFFER_STATUS.EXPIRED, respondedAt: now } },
          { session },
        );
        deferredError = new AppError('This offer has expired.', {
          statusCode: 409,
          code: 'OFFER_EXPIRED',
        });
        return;
      }

      const partner = await Partner.findOne({
        _id: partnerId,
        verificationStatus: PARTNER_VERIFICATION_STATUS.APPROVED,
        activeOrderId: null,
      }).session(session);

      if (!partner) {
        await Offer.updateOne(
          { _id: offer._id, status: OFFER_STATUS.PENDING },
          { $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now } },
          { session },
        );
        deferredError = new AppError('You are no longer available for this request.', {
          statusCode: 409,
          code: 'PARTNER_NOT_AVAILABLE',
        });
        return;
      }

      const currentOrder = await Order.findById(offer.orderId).session(session);
      if (
        !currentOrder ||
        currentOrder.status !== ORDER_STATUS.MATCHING ||
        currentOrder.assignedPartnerId
      ) {
        await Offer.updateOne(
          { _id: offer._id, status: OFFER_STATUS.PENDING },
          { $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now } },
          { session },
        );
        deferredError = new AppError('Another partner already received this request.', {
          statusCode: 409,
          code: 'ORDER_ALREADY_ASSIGNED',
        });
        return;
      }

      const pendingLosers = await Offer.find({
        orderId: currentOrder._id,
        _id: { $ne: offer._id },
        status: OFFER_STATUS.PENDING,
      })
        .select('partnerId')
        .session(session);
      losingPartnerIds = pendingLosers.map((item) => item.partnerId.toString());

      assignedOrder = await Order.findOneAndUpdate(
        {
          _id: currentOrder._id,
          status: ORDER_STATUS.MATCHING,
          assignedPartnerId: null,
        },
        {
          $set: {
            status: ORDER_STATUS.ASSIGNED,
            assignedPartnerId: partner._id,
            assignedTripId: offer.tripId ?? null,
          },
        },
        { new: true, session },
      );

      if (!assignedOrder) {
        throw new AppError('Order assignment conflicted with another acceptance.', {
          statusCode: 409,
          code: 'ORDER_ASSIGNMENT_CONFLICT',
        });
      }

      const partnerUpdate = await Partner.updateOne(
        { _id: partner._id, activeOrderId: null },
        {
          $set: {
            activeOrderId: assignedOrder._id,
            availabilityStatus: PARTNER_AVAILABILITY_STATUS.OFFLINE,
          },
        },
        { session },
      );

      if (partnerUpdate.modifiedCount !== 1) {
        throw new AppError('Partner assignment conflicted with another request.', {
          statusCode: 409,
          code: 'PARTNER_ASSIGNMENT_CONFLICT',
        });
      }

      acceptedOffer = await Offer.findOneAndUpdate(
        { _id: offer._id, status: OFFER_STATUS.PENDING },
        { $set: { status: OFFER_STATUS.ACCEPTED, respondedAt: now } },
        { new: true, session },
      );

      if (!acceptedOffer) {
        throw new AppError('Offer acceptance conflicted with another request.', {
          statusCode: 409,
          code: 'OFFER_ACCEPTANCE_CONFLICT',
        });
      }

      await Offer.updateMany(
        {
          orderId: assignedOrder._id,
          _id: { $ne: acceptedOffer._id },
          status: OFFER_STATUS.PENDING,
        },
        { $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (deferredError) {
    if (matchingAttemptId) await dispatchNextOfferBatch(matchingAttemptId, now);
    throw deferredError;
  }

  const payload = await toPartnerOffer(acceptedOffer, assignedOrder);
  emitToPartner(partnerId.toString(), 'offer:accepted', {
    ...payload,
    orderStatus: ORDER_STATUS.ASSIGNED,
  });

  for (const losingPartnerId of losingPartnerIds) {
    emitToPartner(losingPartnerId, 'offer:cancelled', {
      orderId: assignedOrder._id.toString(),
      reason: 'ORDER_ASSIGNED_TO_ANOTHER_PARTNER',
    });
  }

  emitToCustomer(assignedOrder.customerId.toString(), 'order:assigned', {
    orderId: assignedOrder._id.toString(),
    status: ORDER_STATUS.ASSIGNED,
  });

  return {
    offer: payload,
    order: {
      id: assignedOrder._id.toString(),
      status: assignedOrder.status,
    },
  };
}

export async function expireDueOffersAndAdvance(now = new Date(), limit = 100) {
  const due = await Offer.find({
    status: OFFER_STATUS.PENDING,
    expiresAt: { $lte: now },
  })
    .sort({ expiresAt: 1 })
    .limit(limit);

  if (due.length === 0) return { expired: 0, attemptsAdvanced: 0 };

  await Offer.updateMany(
    { _id: { $in: due.map((offer) => offer._id) }, status: OFFER_STATUS.PENDING },
    { $set: { status: OFFER_STATUS.EXPIRED, respondedAt: now } },
  );

  const attemptIds = [...new Set(due.map((offer) => offer.matchingAttemptId.toString()))];
  for (const offer of due) {
    emitToPartner(offer.partnerId.toString(), 'offer:expired', {
      offerId: offer._id.toString(),
      orderId: offer.orderId.toString(),
    });
  }

  for (const attemptId of attemptIds) {
    await dispatchNextOfferBatch(attemptId, now);
  }

  return { expired: due.length, attemptsAdvanced: attemptIds.length };
}
