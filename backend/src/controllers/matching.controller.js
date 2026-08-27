import { toCustomerMatchingSummary } from '../services/matching-response.service.js';
import { getCustomerMatchingState } from '../services/matching.service.js';

export async function detail(req, res, next) {
  try {
    const state = await getCustomerMatchingState({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });

    res.status(200).json({
      success: true,
      data: {
        orderStatus: state.orderStatus,
        matching: toCustomerMatchingSummary(state.matching),
      },
    });
  } catch (error) {
    next(error);
  }
}
