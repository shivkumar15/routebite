import {
  getCustomerOrderRating,
  getPartnerReceivedRatings,
  submitCustomerRating,
} from '../services/rating.service.js';

export async function detail(req, res, next) {
  try {
    const result = await getCustomerOrderRating({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const result = await submitCustomerRating({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
      score: req.body.score,
      feedback: req.body.feedback ?? '',
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function partnerReviews(req, res, next) {
  try {
    const result = await getPartnerReceivedRatings(req.auth.partnerId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
