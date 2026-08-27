import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Order } from '../models/order.model.js';
import { AppError } from '../utils/app-error.js';
import { toCustomerMatchingSummary } from './matching-response.service.js';

function attemptToInternalResult(attempt) {
  if (!attempt) return null;
  return {
    id: attempt._id.toString(),
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    resumeAt: attempt.resumeAt,
    routeSource: attempt.routeSource,
    discoveredCandidateCount: attempt.discoveredCandidateCount,
    eligibleCandidateCount: attempt.eligibleCandidateCount,
    offerReadyPartnerIds: attempt.offerReadyPartnerIds,
    candidates: attempt.candidates,
    rejectionSummary: attempt.rejectionSummary,
    failureReason: attempt.failureReason,
    completedAt: attempt.completedAt,
  };
}

export async function getCustomerMatchingSummary({ customerId, orderId }) {
  const order = await Order.findOne({ _id: orderId, customerId }).select('status');
  if (!order) {
    throw new AppError('Order not found.', {
      statusCode: 404,
      code: 'ORDER_NOT_FOUND',
    });
  }

  const attempt = await MatchingAttempt.findOne({ orderId }).sort({ attemptNumber: -1 });
  return {
    orderStatus: order.status,
    matching: toCustomerMatchingSummary(attemptToInternalResult(attempt)),
  };
}
