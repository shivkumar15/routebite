import { DELIVERY_OPERATION_LIMITS } from '../constants/delivery.constants.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { AppError } from '../utils/app-error.js';

function toPartnerActiveOrder(order) {
  if (!order) return null;

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
    assignedTripId: order.assignedTripId?.toString?.() ?? null,
    expectedEarningPaise: order.pricing.partnerBaseEarningPaise,
    estimatedFoodCostPaise: order.pricing.estimatedFoodCostPaise,
    finalCustomerTotalPaise: order.pricing.finalCustomerTotalPaise ?? null,
    priceAdjustment: {
      status: order.priceAdjustment?.status ?? 'NONE',
      actualFoodCostPaise: order.priceAdjustment?.actualFoodCostPaise ?? null,
      differencePaise: order.priceAdjustment?.differencePaise ?? null,
      receiptAttached: Boolean(order.priceAdjustment?.receiptAssetId),
      reportedAt: order.priceAdjustment?.reportedAt ?? null,
      approvalExpiresAt: order.priceAdjustment?.approvalExpiresAt ?? null,
      resolvedAt: order.priceAdjustment?.resolvedAt ?? null,
    },
    deliveryOtp: {
      requestedAt: order.deliveryOtpRequestedAt ?? null,
      generated: Boolean(
        order.deliveryOtp?.generatedAt &&
        order.deliveryOtp?.expiresAt &&
        !order.deliveryOtp?.usedAt
      ),
      generatedAt: order.deliveryOtp?.generatedAt ?? null,
      expiresAt: order.deliveryOtp?.expiresAt ?? null,
      attempts: order.deliveryOtp?.attempts ?? 0,
      maxAttempts: DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_MAX_ATTEMPTS,
      usedAt: order.deliveryOtp?.usedAt ?? null,
    },
    pickupStartedAt: order.pickupStartedAt ?? null,
    pickedUpAt: order.pickedUpAt ?? null,
    deliveryStartedAt: order.deliveryStartedAt ?? null,
    deliveredAt: order.deliveredAt ?? null,
    completedAt: order.completedAt ?? null,
    assignedAt: order.updatedAt,
  };
}

export async function getPartnerActiveOrder(partnerId) {
  const partner = await Partner.findById(partnerId).select('activeOrderId');
  if (!partner) {
    throw new AppError('Partner not found.', {
      statusCode: 404,
      code: 'PARTNER_NOT_FOUND',
    });
  }

  if (!partner.activeOrderId) return null;

  const order = await Order.findOne({
    _id: partner.activeOrderId,
    assignedPartnerId: partner._id,
  });

  if (!order) {
    throw new AppError('Active order reference is inconsistent.', {
      statusCode: 409,
      code: 'ACTIVE_ORDER_INCONSISTENT',
    });
  }

  return toPartnerActiveOrder(order);
}
