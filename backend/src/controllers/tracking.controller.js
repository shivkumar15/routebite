import {
  getCustomerTracking,
  startDeliveryTracking,
  updateActiveDeliveryLocation,
} from '../services/tracking.service.js';
import { getPartnerActiveOrder } from '../services/partner-active-order.service.js';

export async function startPartnerDelivery(req, res, next) {
  try {
    await startDeliveryTracking({ partnerId: req.auth.partnerId });
    const order = await getPartnerActiveOrder(req.auth.partnerId);
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}

export async function updatePartnerDeliveryLocation(req, res, next) {
  try {
    const tracking = await updateActiveDeliveryLocation({
      partnerId: req.auth.partnerId,
      payload: req.body,
    });
    res.status(200).json({ success: true, data: { tracking } });
  } catch (error) {
    next(error);
  }
}

export async function customerTracking(req, res, next) {
  try {
    const tracking = await getCustomerTracking({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });
    res.status(200).json({ success: true, data: { tracking } });
  } catch (error) {
    next(error);
  }
}
