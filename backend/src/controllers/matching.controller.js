import { getCustomerMatchingState } from '../services/matching.service.js';

export async function detail(req, res, next) {
  try {
    const state = await getCustomerMatchingState({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });

    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
}
