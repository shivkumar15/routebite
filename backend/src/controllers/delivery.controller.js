import {
  confirmFoodPickup,
  reportActualFoodPrice,
  resolveCustomerPriceDecision,
  startPickup,
} from '../services/delivery.service.js';
import { getPartnerActiveOrder } from '../services/partner-active-order.service.js';
import { getCustomerOrder } from '../services/order.service.js';

export async function startPartnerPickup(req, res, next) {
  try {
    await startPickup({ partnerId: req.auth.partnerId });
    const order = await getPartnerActiveOrder(req.auth.partnerId);
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}

export async function reportPartnerPrice(req, res, next) {
  try {
    await reportActualFoodPrice({
      partnerId: req.auth.partnerId,
      actualFoodCostPaise: req.body.actualFoodCostPaise,
      receiptAssetId: req.body.receiptAssetId ?? null,
    });
    const order = await getPartnerActiveOrder(req.auth.partnerId);
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}

export async function confirmPartnerPickup(req, res, next) {
  try {
    await confirmFoodPickup({ partnerId: req.auth.partnerId });
    const order = await getPartnerActiveOrder(req.auth.partnerId);
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}

async function respondToPriceDecision(req, res, next, decision) {
  try {
    await resolveCustomerPriceDecision({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
      decision,
    });
    const order = await getCustomerOrder({
      customerId: req.auth.userId,
      orderId: req.params.orderId,
    });
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
}

export function approvePrice(req, res, next) {
  return respondToPriceDecision(req, res, next, 'APPROVE');
}

export function rejectPrice(req, res, next) {
  return respondToPriceDecision(req, res, next, 'REJECT');
}
