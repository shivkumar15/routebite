import { DELIVERY_OPERATION_LIMITS } from '../constants/delivery.constants.js';
import { DELIVERY_TYPE, MAX_ASAP_DELIVERY_MINUTES, ORDER_STATUS } from '../constants/order.constants.js';
import { Order } from '../models/order.model.js';
import { calculateCheckoutPricing } from './pricing.service.js';
import { AppError } from '../utils/app-error.js';

function pointFromInput(location) {
  return {
    type: 'Point',
    coordinates: [Number(location.longitude), Number(location.latitude)],
  };
}

function resolveDeliveryWindow(payload, now = new Date()) {
  if (payload.deliveryType === DELIVERY_TYPE.ASAP) {
    const start = new Date(now);
    const end = new Date(now.getTime() + MAX_ASAP_DELIVERY_MINUTES * 60 * 1000);
    return { start, end };
  }

  const start = new Date(payload.deliveryWindowStart);
  const end = new Date(payload.deliveryWindowEnd);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    throw new AppError('Scheduled delivery requires valid start and end times.', {
      statusCode: 422,
      code: 'INVALID_DELIVERY_WINDOW',
    });
  }

  if (start.getTime() <= now.getTime()) {
    throw new AppError('Scheduled delivery must start in the future.', {
      statusCode: 422,
      code: 'DELIVERY_WINDOW_NOT_FUTURE',
    });
  }

  if (end.getTime() <= start.getTime()) {
    throw new AppError('Delivery window end must be after its start.', {
      statusCode: 422,
      code: 'INVALID_DELIVERY_WINDOW',
    });
  }

  return { start, end };
}

function safePricing(order) {
  const estimate = calculateCheckoutPricing(order.pricing.estimatedFoodCostPaise);
  return {
    ...estimate,
    finalCustomerTotalPaise: order.pricing.finalCustomerTotalPaise ?? null,
  };
}

function safePriceAdjustment(order) {
  const adjustment = order.priceAdjustment;
  return {
    status: adjustment?.status ?? 'NONE',
    actualFoodCostPaise: adjustment?.actualFoodCostPaise ?? null,
    differencePaise: adjustment?.differencePaise ?? null,
    receiptAttached: Boolean(adjustment?.receiptAssetId),
    reportedAt: adjustment?.reportedAt ?? null,
    approvalExpiresAt: adjustment?.approvalExpiresAt ?? null,
    resolvedAt: adjustment?.resolvedAt ?? null,
  };
}

function safeDeliveryOtp(order) {
  const otp = order.deliveryOtp ?? {};
  return {
    requestedAt: order.deliveryOtpRequestedAt ?? null,
    generated: Boolean(otp.generatedAt && otp.expiresAt && !otp.usedAt),
    generatedAt: otp.generatedAt ?? null,
    expiresAt: otp.expiresAt ?? null,
    attempts: otp.attempts ?? 0,
    maxAttempts: DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_MAX_ATTEMPTS,
    usedAt: otp.usedAt ?? null,
  };
}

function toSafeOrder(order) {
  return {
    id: order._id.toString(),
    status: order.status,
    vendorDisplayName: order.vendorDisplayName,
    requestedItems: order.requestedItems,
    pickupInstructions: order.pickupInstructions,
    pickup: {
      label: order.pickupText,
      longitude: order.pickup.coordinates[0],
      latitude: order.pickup.coordinates[1],
    },
    drop: {
      label: order.dropText,
      longitude: order.drop.coordinates[0],
      latitude: order.drop.coordinates[1],
    },
    deliveryType: order.deliveryType,
    deliveryWindowStart: order.deliveryWindowStart,
    deliveryWindowEnd: order.deliveryWindowEnd,
    estimatedFoodCostPaise: order.pricing.estimatedFoodCostPaise,
    pricing: safePricing(order),
    priceAdjustment: safePriceAdjustment(order),
    deliveryOtp: safeDeliveryOtp(order),
    pickupStartedAt: order.pickupStartedAt ?? null,
    pickedUpAt: order.pickedUpAt ?? null,
    deliveryStartedAt: order.deliveryStartedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    completedAt: order.completedAt ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function buildDraftFields(payload, now = new Date()) {
  const { start, end } = resolveDeliveryWindow(payload, now);

  return {
    vendorDisplayName: payload.vendorDisplayName.trim(),
    requestedItems: payload.requestedItems.trim(),
    pickupInstructions: payload.pickupInstructions?.trim() ?? '',
    pickup: pointFromInput(payload.pickup),
    pickupText: payload.pickup.label.trim(),
    drop: pointFromInput(payload.drop),
    dropText: payload.drop.label.trim(),
    deliveryType: payload.deliveryType,
    deliveryWindowStart: start,
    deliveryWindowEnd: end,
    pricing: {
      estimatedFoodCostPaise: payload.estimatedFoodCostPaise,
    },
  };
}

export async function createDraftOrder({ customerId, payload }) {
  const order = await Order.create({
    customerId,
    status: ORDER_STATUS.DRAFT,
    ...buildDraftFields(payload),
  });

  return toSafeOrder(order);
}

export async function listCustomerOrders(customerId) {
  const orders = await Order.find({ customerId }).sort({ createdAt: -1 });
  return orders.map(toSafeOrder);
}

export async function getCustomerOrder({ customerId, orderId }) {
  const order = await Order.findOne({ _id: orderId, customerId });

  if (!order) {
    throw new AppError('Order not found.', {
      statusCode: 404,
      code: 'ORDER_NOT_FOUND',
    });
  }

  return toSafeOrder(order);
}

export async function updateDraftOrder({ customerId, orderId, payload }) {
  const fields = buildDraftFields(payload);

  const order = await Order.findOneAndUpdate(
    { _id: orderId, customerId, status: ORDER_STATUS.DRAFT },
    { $set: fields },
    { returnDocument: 'after', runValidators: true },
  );

  if (!order) {
    const exists = await Order.exists({ _id: orderId, customerId });
    throw new AppError(
      exists ? 'Only draft orders can be edited.' : 'Order not found.',
      {
        statusCode: exists ? 409 : 404,
        code: exists ? 'ORDER_NOT_EDITABLE' : 'ORDER_NOT_FOUND',
      },
    );
  }

  return toSafeOrder(order);
}

export { resolveDeliveryWindow };
