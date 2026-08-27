import { MATCHING_ATTEMPT_STATUS } from '../constants/matching.constants.js';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Order } from '../models/order.model.js';
import {
  dispatchNextOfferBatch,
  expireDueOffersAndAdvance,
} from './offer.service.js';

export async function runOfferMaintenance(now = new Date(), limit = 20) {
  const expiryResult = await expireDueOffersAndAdvance(now);

  const attempts = await MatchingAttempt.find({
    status: MATCHING_ATTEMPT_STATUS.CANDIDATES_READY,
  })
    .sort({ completedAt: 1 })
    .limit(limit)
    .select('_id orderId');

  let resumed = 0;
  for (const attempt of attempts) {
    const orderStillMatching = await Order.exists({
      _id: attempt.orderId,
      status: ORDER_STATUS.MATCHING,
      assignedPartnerId: null,
    });
    if (!orderStillMatching) continue;

    const result = await dispatchNextOfferBatch(attempt._id, now);
    if (result.dispatched > 0) resumed += 1;
  }

  return {
    ...expiryResult,
    resumed,
  };
}
