import { MATCHING_ATTEMPT_STATUS, MATCHING_LIMITS } from '../constants/matching.constants.js';
import { DELIVERY_TYPE, ORDER_STATUS } from '../constants/order.constants.js';
import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Order } from '../models/order.model.js';
import { runMatchingForOrder } from './matching.service.js';

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

function scheduledResumeAt(order) {
  return new Date(
    new Date(order.deliveryWindowStart).getTime() -
      MATCHING_LIMITS.SCHEDULED_MATCHING_LEAD_MINUTES * 60 * 1000,
  );
}

export async function startOrDeferMatching(orderId, now = new Date()) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== ORDER_STATUS.MATCHING) return null;

  if (order.deliveryType === DELIVERY_TYPE.SCHEDULED) {
    const resumeAt = scheduledResumeAt(order);
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

  return runMatchingForOrder(order._id, now);
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
      const result = await runMatchingForOrder(attempt.orderId, now);
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
