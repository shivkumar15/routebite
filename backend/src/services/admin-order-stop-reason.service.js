import { OFFER_STATUS } from '../constants/offer.constants.js';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Offer } from '../models/offer.model.js';

const STOPPED_STATUSES = new Set([
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.MATCHING_FAILED,
  ORDER_STATUS.FAILED,
  ORDER_STATUS.ADMIN_REVIEW_REQUIRED,
]);

function summarizeRejections(summary = {}) {
  const entries = Object.entries(summary)
    .filter(([, count]) => Number(count) > 0)
    .sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) return null;
  return entries.map(([reason, count]) => `${reason} × ${count}`).join(' · ');
}

function recoveryReason(order) {
  const reason = order.recovery?.reason?.trim?.();
  return reason || null;
}

export function buildAdminStopReason({ order, latestAttempt = null, offers = [] }) {
  if (!order || !STOPPED_STATUSES.has(order.status)) return null;

  const recovery = recoveryReason(order);

  if (order.status === ORDER_STATUS.CANCELLED) {
    return {
      kind: 'CANCELLATION',
      title: 'Cancellation reason',
      reason: recovery ?? 'The request was cancelled before completion.',
      detail:
        order.recovery?.lastEvent && order.recovery.lastEvent !== 'NONE'
          ? order.recovery.lastEvent
          : null,
    };
  }

  if (order.status === ORDER_STATUS.ADMIN_REVIEW_REQUIRED) {
    return {
      kind: 'ADMIN_REVIEW',
      title: 'Why review is required',
      reason: recovery ?? 'The order reached a state that requires a human operations decision.',
      detail:
        order.recovery?.lastEvent && order.recovery.lastEvent !== 'NONE'
          ? order.recovery.lastEvent
          : null,
    };
  }

  const rejectionDetail = summarizeRejections(latestAttempt?.rejectionSummary);

  if (order.status === ORDER_STATUS.MATCHING_FAILED) {
    const resolvedOffers = offers.filter((offer) => offer.status !== OFFER_STATUS.PENDING);
    const expiredOffers = resolvedOffers.filter((offer) => offer.status === OFFER_STATUS.EXPIRED);
    const acceptedOffer = offers.some((offer) => offer.status === OFFER_STATUS.ACCEPTED);

    if (!acceptedOffer && offers.length > 0 && expiredOffers.length === offers.length) {
      return {
        kind: 'MATCHING',
        title: 'Why matching failed',
        reason:
          offers.length === 1
            ? 'An eligible partner received the offer, but it expired before acceptance and no other candidate remained.'
            : 'Eligible partners received offers, but every offer expired before acceptance and no candidate remained.',
        detail: rejectionDetail,
      };
    }

    return {
      kind: 'MATCHING',
      title: 'Why matching failed',
      reason:
        latestAttempt?.failureReason?.trim?.() ||
        recovery ||
        'No eligible partner completed matching for this request.',
      detail: rejectionDetail,
    };
  }

  return {
    kind: 'FAILURE',
    title: 'Failure reason',
    reason:
      recovery ||
      latestAttempt?.failureReason?.trim?.() ||
      'The order entered a terminal failure state.',
    detail: rejectionDetail,
  };
}

export async function attachAdminOrderStopReasons(result) {
  const stoppedOrders = (result.orders ?? []).filter((order) => STOPPED_STATUSES.has(order.status));
  if (stoppedOrders.length === 0) return result;

  const orderIds = stoppedOrders.map((order) => order.id);
  const [attempts, offers] = await Promise.all([
    MatchingAttempt.find({ orderId: { $in: orderIds } })
      .sort({ attemptNumber: -1 })
      .select('orderId attemptNumber failureReason rejectionSummary status completedAt createdAt')
      .lean(),
    Offer.find({ orderId: { $in: orderIds } })
      .sort({ createdAt: 1 })
      .select('orderId status createdAt respondedAt expiresAt')
      .lean(),
  ]);

  const latestAttemptByOrder = new Map();
  for (const attempt of attempts) {
    const key = attempt.orderId.toString();
    if (!latestAttemptByOrder.has(key)) latestAttemptByOrder.set(key, attempt);
  }

  const offersByOrder = new Map();
  for (const offer of offers) {
    const key = offer.orderId.toString();
    const current = offersByOrder.get(key) ?? [];
    current.push(offer);
    offersByOrder.set(key, current);
  }

  return {
    ...result,
    orders: (result.orders ?? []).map((order) => ({
      ...order,
      stopReason: buildAdminStopReason({
        order,
        latestAttempt: latestAttemptByOrder.get(order.id) ?? null,
        offers: offersByOrder.get(order.id) ?? [],
      }),
    })),
  };
}
