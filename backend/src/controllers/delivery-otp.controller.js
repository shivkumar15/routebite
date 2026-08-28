import {
  generateCustomerDeliveryOtp,
  requestDeliveryOtp,
  verifyDeliveryOtpAndComplete,
} from '../services/delivery-otp.service.js';
import { getPartnerActiveOrder } from '../services/partner-active-order.service.js';
import { getCustomerOrder } from '../services/order.service.js';

export async function requestPartnerDeliveryOtp(req, res, next) {
  try {
    await requestDeliveryOtp({ partnerId: req.auth.partnerId });
    const order = await getPartnerActiveOrder(req.auth.partnerId);
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}

export async function generateDeliveryOtp(req, res, next) {
  try {
    const deliveryOtp = await generateCustomerDeliveryOtp({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });
    const order = await getCustomerOrder({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });
    res.status(200).json({ success: true, data: { order, deliveryOtp } });
  } catch (error) {
    next(error);
  }
}

export async function verifyPartnerDeliveryOtp(req, res, next) {
  try {
    const completedOrder = await verifyDeliveryOtpAndComplete({
      partnerId: req.auth.partnerId,
      otp: req.body.otp,
    });
    res.status(200).json({
      success: true,
      data: {
        order: null,
        completedOrder,
      },
    });
  } catch (error) {
    next(error);
  }
}
