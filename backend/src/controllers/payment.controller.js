import {
  createOrReusePaymentAttempt,
  getLatestCustomerPayment,
  verifyAndConfirmPayment,
} from '../services/payment.service.js';

export async function createPayment(req, res, next) {
  try {
    const result = await createOrReusePaymentAttempt({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
      idempotencyKey: req.get('Idempotency-Key'),
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const result = await verifyAndConfirmPayment({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
      providerOrderId: req.body.razorpayOrderId,
      providerPaymentId: req.body.razorpayPaymentId,
      providerSignature: req.body.razorpaySignature,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function paymentStatus(req, res, next) {
  try {
    const payment = await getLatestCustomerPayment({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });

    res.status(200).json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
}
