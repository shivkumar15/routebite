import { handleRazorpayWebhook } from '../services/webhook.service.js';

export async function razorpayWebhook(req, res, next) {
  try {
    const result = await handleRazorpayWebhook({
      rawBody: req.body,
      signature: req.get('x-razorpay-signature'),
      eventId: req.get('x-razorpay-event-id'),
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
