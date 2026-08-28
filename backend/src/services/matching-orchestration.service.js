import { MATCHING_ATTEMPT_STATUS, MATCHING_LIMITS } from '../constants/matching.constants.js';
import { DELIVERY_TYPE, ORDER_STATUS } from '../constants/order.constants.js';
import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Order } from '../models/order.model.js';
import { runMatchingForOrder } from './matching.service.js';
import { dispatchNextOfferBatch } from './offer.service.js';

function waitingAttemptToResult(attempt) {
  return {
    id: attempt._id.toString(),
    orderId: attempt.orderId.toString(),
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    resumeAt: attempt.resumeAt,
    routeSource: null,
    discoveredCandidateCount: 0,
    eligibleCandidateCount: 0,
    offerReadyPartnerIds: [],
    candidates: [],
    rejectionSummary: {},
    failureReason: null,
    completedAt: null,
  };
}

async function removeExcludedRecoveryCandidates(order, result, now) {
  if (result?.status !== MATCHING_ATTEMPT_STATUS.CANDIDATES_READY) return result;

  const excluded = new Set(
    (order.recovery?.excludedPartnerIds ?? []).map((id) => id.toString()),
  );
  if (excluded.size === 0) return result;

  const eligibleCandidates = result.candidates.filter(
    (candidate) => !excluded.has(candidate.partnerId.toString()),
  );

  if (eligibleCandidates.length === result.candidates.length) return result;

  if (eligibleCandidates.length === 0) {
    const reason = 'All eligible candidates were excluded after a prior partner cancellation.';
    await MatchingAttempt.updateOne(
      { _id: result.id, status: MATCHING_ATTEMPT_STATUS.CANDIDATES_READY },
      {
        $set: {
          status: MATCHING_ATTEMPT_STATUS.NO_CANDIDATES,
          eligibleCandidateCount: 0,
          candidates: [],
          offerReadyPartnerIds: [],
          failureReason: reason,
          completedAt: now,
        },
      },
    );
    await Order.updateOne(
      { _id: order._id, status: ORDER_STATUS.MATCHING, assignedPartnerId: null },
      { $set: { status: ORDER_STATUS.MATCHING_FAILED } },
    );
    return {
      ...result,
      status: MATCHING_ATTEMPT_STATUS.NO_CANDIDATES,
      eligibleCandidateCount: 0,
      candidates: [],
      offerReadyPartnerIds: [],
      failureReason: reason,
    };
  }

  const reranked = eligibleCandidates.map((candidate, index) => ({
    ...candidate,
    rankPosition: index + 1,
  }));
  const offerReadyPartnerIds = reranked
    .slice(0, MATCHING_LIMITS.OFFER_BATCH_SIZE)
    .map((candidate) => candidate.partnerId);

  await MatchingAttempt.updateOne(
    { _id: result.id, status: MATCHING_ATTEMPT_STATUS.CANDIDATES_READY },
    {
      $set: {
        eligibleCandidateCount: reranked.length,
        candidates: reranked,
        offerReadyPartnerIds,
      },
    },
  );

  return {
    ...result,
    eligibleCandidateCount: reranked.length,
    candidates: reranked,
    offerReadyPartnerIds,
  };
}

async function runAndDispatch(orderId, now) {
  const result = await runMatchingForOrder(orderId, now);
  const order = await Order.findById(orderId);
  const filtered = order
    ? await removeExcludedRecoveryCandidates(order, result, now)
    : result;

  if (filtered?.status === MATCHING_ATTEMPT_STATUS.CANDIDATES_READY) {
    await dispatchNextOfferBatch(filtered.id, now);
  }
  return filtered;
}

export function getScheduledMatchingResumeAt(order) {
  return new Date(
    new Date(order.deliveryWindowStart).getTime() -
      MATCHING_LIMITS.SCHEDULED_MATCHING_LEAD_MINUTES * 60 * 1000,
  );
}

export async function startOrDeferMatching(orderId, now = new Date()) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== ORDER_STATUS.MATCHING) return null;

  if (order.deliveryType === DELIVERY_TYPE.SCHEDULED) {
    const resumeAt = getScheduledMatchingResumeAt(order);
    if (resumeAt.getTime() > now.getTime()) {
      let waiting = await MatchingAttempt.findOne({
        orderId: order._id,
        status: MATCHING_ATTEMPT_STATUS.WAITING_FOR_HORIZON,
      });

      if (!waiting) {
        const latest = await MatchingAttempt.findOne({ orderId: order._id }).sort({ attemptNumber: -1 });
        waiting = await MatchingAttempt.create({
          orderId: order._id,
          attemptNumber: (latest?.attemptNumber ?? 0) + 1,
          status: MATCHING_ATTEMPT_STATUS.WAITING_FOR_HORIZON,
          resumeAt,
        });
      }

      return waitingAttemptToResult(waiting);
    }
  }

  const waiting = await MatchingAttempt.findOne({
    orderId: order._id,
    status: MATCHING_ATTEMPT_STATUS.WAITING_FOR_HORIZON,
  });
  if (waiting) await MatchingAttempt.deleteOne({ _id: waiting._id });

  return runAndDispatch(order._id, now);
}

export async function resumeDueMatchingAttempts(now = new Date(), limit = 10) {
  const waiting = await MatchingAttempt.find({
    status: MATCHING_ATTEMPT_STATUS.WAITING_FOR_HORIZON,
    resumeAt: { $lte: now },
  })
    .sort({ resumeAt: 1 })
    .limit(limit);

  const results = [];
  for (const attempt of waiting) {
    await MatchingAttempt.deleteOne({
      _id: attempt._id,
      status: MATCHING_ATTEMPT_STATUS.WAITING_FOR_HORIZON,
    });
    try {
      const result = await runAndDispatch(attempt.orderId, now);
      results.push(result);
    } catch (error) {
      console.error('Scheduled matching resume failed', {
        orderId: attempt.orderId.toString(),
        message: error.message,
      });
    }
  }

  return results;
}
