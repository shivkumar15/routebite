import mongoose from 'mongoose';
import {
  DELIVERY_OPERATION_LIMITS,
  PRICE_ADJUSTMENT_STATUS,
} from '../constants/delivery.constants.js';
import { ORDER_STATUS } from '../constants/order.constants.js';
import {
  PARTNER_AVAILABILITY_STATUS,
  UPLOAD_PURPOSE,
} from '../constants/partner.constants.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { UploadAsset } from '../models/upload-asset.model.js';
import { getSocketServer } from '../socket/index.js';
import { AppError } from '../utils/app-error.js';

function emitToPartner(partnerId, eventName, payload) {
  getSocketServer()?.to(`partner:${partnerId}`).emit(eventName, payload);
}

function emitToCustomer(customerId, eventName, payload) {
  getSocketServer()?.to(`user:${customerId}`).emit(eventName, payload);
}

function finalTotalFor(order, actualFoodCostPaise) {
  return (
    actualFoodCostPaise +
    order.pricing.customerDeliveryChargePaise +
    order.pricing.platformFeePaise
  );
}

async function getActivePartnerOrder(partnerId, session = null) {
  let partnerQuery = Partner.findById(partnerId);
  if (session) partnerQuery = partnerQuery.session(session);
  const partner = await partnerQuery;

  if (!partner?.activeOrderId) {
    throw new AppError('You do not have an active delivery.', {
      statusCode: 409,
      code: 'ACTIVE_ORDER_REQUIRED',
    });
  }

  let orderQuery = Order.findOne({
    _id: partner.activeOrderId,
    assignedPartnerId: partner._id,
  });
  if (session) orderQuery = orderQuery.session(session);
  const order = await orderQuery;

  if (!order) {
    throw new AppError('Active order reference is inconsistent.', {
      statusCode: 409,
      code: 'ACTIVE_ORDER_INCONSISTENT',
    });
  }

  return { partner, order };
}

async function validateReceiptAsset({ receiptAssetId, ownerUserId, session = null }) {
  if (!receiptAssetId) return null;

  let query = UploadAsset.findOne({
    _id: receiptAssetId,
    ownerUserId,
    purpose: UPLOAD_PURPOSE.ORDER_RECEIPT,
  });
  if (session) query = query.session(session);
  const asset = await query;

  if (!asset) {
    throw new AppError('Receipt image is invalid or does not belong to this partner.', {
      statusCode: 422,
      code: 'INVALID_RECEIPT_ASSET',
    });
  }

  return asset;
}

export async function startPickup({ partnerId }, now = new Date()) {
  const { order } = await getActivePartnerOrder(partnerId);

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      assignedPartnerId: partnerId,
      status: ORDER_STATUS.ASSIGNED,
    },
    {
      $set: {
        status: ORDER_STATUS.PARTNER_TO_PICKUP,
        pickupStartedAt: now,
      },
    },
    { returnDocument: 'after', runValidators: true },
  );

  if (!updated) {
    throw new AppError('This delivery cannot start pickup from its current state.', {
      statusCode: 409,
      code: 'PICKUP_START_CONFLICT',
    });
  }

  emitToCustomer(updated.customerId.toString(), 'order:pickup-started', {
    orderId: updated._id.toString(),
    status: updated.status,
  });

  return updated;
}

export async function reportActualFoodPrice(
  { partnerId, actualFoodCostPaise, receiptAssetId = null },
  now = new Date(),
) {
  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      const { partner, order } = await getActivePartnerOrder(partnerId, session);

      if (order.status !== ORDER_STATUS.PARTNER_TO_PICKUP) {
        throw new AppError('Actual food price can only be reported while heading to pickup.', {
          statusCode: 409,
          code: 'PRICE_REPORT_NOT_ALLOWED',
        });
      }

      if (order.priceAdjustment?.reportedAt) {
        throw new AppError('Actual food price has already been reported for this order.', {
          statusCode: 409,
          code: 'PRICE_ALREADY_REPORTED',
        });
      }

      await validateReceiptAsset({
        receiptAssetId,
        ownerUserId: partner.userId,
        session,
      });

      const estimate = order.pricing.estimatedFoodCostPaise;
      const differencePaise = actualFoodCostPaise - estimate;
      const baseAdjustment = {
        actualFoodCostPaise,
        differencePaise,
        receiptAssetId: receiptAssetId || null,
        reportedAt: now,
      };

      if (differencePaise > 0) {
        const approvalExpiresAt = new Date(
          now.getTime() +
            DELIVERY_OPERATION_LIMITS.PRICE_CONFIRMATION_TIMEOUT_MINUTES * 60 * 1000,
        );

        order.status = ORDER_STATUS.PRICE_CONFIRMATION_REQUIRED;
        order.priceAdjustment = {
          ...baseAdjustment,
          status: PRICE_ADJUSTMENT_STATUS.PENDING_CUSTOMER_APPROVAL,
          approvalExpiresAt,
          resolvedAt: null,
        };
      } else {
        order.pricing.finalCustomerTotalPaise = finalTotalFor(order, actualFoodCostPaise);
        order.priceAdjustment = {
          ...baseAdjustment,
          status:
            differencePaise < 0
              ? PRICE_ADJUSTMENT_STATUS.AUTO_DECREASED
              : PRICE_ADJUSTMENT_STATUS.NONE,
          approvalExpiresAt: null,
          resolvedAt: now,
        };
      }

      await order.save({ session });
      result = order;
    });
  } finally {
    await session.endSession();
  }

  if (result.status === ORDER_STATUS.PRICE_CONFIRMATION_REQUIRED) {
    emitToCustomer(result.customerId.toString(), 'price:approval-required', {
      orderId: result._id.toString(),
      status: result.status,
      actualFoodCostPaise: result.priceAdjustment.actualFoodCostPaise,
      differencePaise: result.priceAdjustment.differencePaise,
      approvalExpiresAt: result.priceAdjustment.approvalExpiresAt,
    });
  } else {
    emitToCustomer(result.customerId.toString(), 'price:resolved', {
      orderId: result._id.toString(),
      status: result.status,
      priceAdjustmentStatus: result.priceAdjustment.status,
      actualFoodCostPaise: result.priceAdjustment.actualFoodCostPaise,
      finalCustomerTotalPaise: result.pricing.finalCustomerTotalPaise,
    });
  }

  return result;
}

export async function resolveCustomerPriceDecision(
  { customerId, orderId, decision },
  now = new Date(),
) {
  const session = await mongoose.startSession();
  let order = null;
  let partnerId = null;

  try {
    await session.withTransaction(async () => {
      order = await Order.findOne({ _id: orderId, customerId }).session(session);
      if (!order) {
        throw new AppError('Order not found.', {
          statusCode: 404,
          code: 'ORDER_NOT_FOUND',
        });
      }

      if (
        order.status !== ORDER_STATUS.PRICE_CONFIRMATION_REQUIRED ||
        order.priceAdjustment?.status !==
          PRICE_ADJUSTMENT_STATUS.PENDING_CUSTOMER_APPROVAL
      ) {
        throw new AppError('This order is not waiting for a price decision.', {
          statusCode: 409,
          code: 'PRICE_DECISION_NOT_PENDING',
        });
      }

      if (
        !order.priceAdjustment.approvalExpiresAt ||
        order.priceAdjustment.approvalExpiresAt.getTime() <= now.getTime()
      ) {
        throw new AppError('The price approval window has expired.', {
          statusCode: 409,
          code: 'PRICE_APPROVAL_EXPIRED',
        });
      }

      partnerId = order.assignedPartnerId;

      if (decision === 'APPROVE') {
        order.status = ORDER_STATUS.PARTNER_TO_PICKUP;
        order.priceAdjustment.status = PRICE_ADJUSTMENT_STATUS.APPROVED;
        order.priceAdjustment.resolvedAt = now;
        order.pricing.finalCustomerTotalPaise = finalTotalFor(
          order,
          order.priceAdjustment.actualFoodCostPaise,
        );
        await order.save({ session });
        return;
      }

      order.status = ORDER_STATUS.CANCELLED;
      order.priceAdjustment.status = PRICE_ADJUSTMENT_STATUS.REJECTED;
      order.priceAdjustment.resolvedAt = now;
      await order.save({ session });

      if (partnerId) {
        await Partner.updateOne(
          { _id: partnerId, activeOrderId: order._id },
          {
            $set: {
              activeOrderId: null,
              availabilityStatus: PARTNER_AVAILABILITY_STATUS.OFFLINE,
            },
            $inc: { cancelledOrderCount: 1 },
          },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  if (decision === 'APPROVE') {
    emitToPartner(partnerId?.toString(), 'price:approved', {
      orderId: order._id.toString(),
      status: order.status,
      actualFoodCostPaise: order.priceAdjustment.actualFoodCostPaise,
    });
  } else {
    emitToPartner(partnerId?.toString(), 'price:rejected', {
      orderId: order._id.toString(),
      status: order.status,
    });
  }

  return order;
}

export async function confirmFoodPickup({ partnerId }, now = new Date()) {
  const { order } = await getActivePartnerOrder(partnerId);

  if (order.status !== ORDER_STATUS.PARTNER_TO_PICKUP) {
    throw new AppError('Food pickup cannot be confirmed from the current order state.', {
      statusCode: 409,
      code: 'PICKUP_CONFIRM_NOT_ALLOWED',
    });
  }

  if (order.priceAdjustment?.actualFoodCostPaise == null) {
    throw new AppError('Report the actual food price before confirming pickup.', {
      statusCode: 409,
      code: 'ACTUAL_PRICE_REQUIRED',
    });
  }

  if (
    order.priceAdjustment.status ===
    PRICE_ADJUSTMENT_STATUS.PENDING_CUSTOMER_APPROVAL
  ) {
    throw new AppError('Wait for customer price approval before confirming pickup.', {
      statusCode: 409,
      code: 'PRICE_APPROVAL_REQUIRED',
    });
  }

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      assignedPartnerId: partnerId,
      status: ORDER_STATUS.PARTNER_TO_PICKUP,
    },
    {
      $set: {
        status: ORDER_STATUS.PICKED_UP,
        pickedUpAt: now,
      },
    },
    { returnDocument: 'after', runValidators: true },
  );

  if (!updated) {
    throw new AppError('Pickup confirmation conflicted with another update.', {
      statusCode: 409,
      code: 'PICKUP_CONFIRM_CONFLICT',
    });
  }

  emitToCustomer(updated.customerId.toString(), 'order:picked-up', {
    orderId: updated._id.toString(),
    status: updated.status,
  });

  return updated;
}

export async function expireDuePriceConfirmations(now = new Date(), limit = 50) {
  const due = await Order.find({
    status: ORDER_STATUS.PRICE_CONFIRMATION_REQUIRED,
    'priceAdjustment.status': PRICE_ADJUSTMENT_STATUS.PENDING_CUSTOMER_APPROVAL,
    'priceAdjustment.approvalExpiresAt': { $lte: now },
  })
    .sort({ 'priceAdjustment.approvalExpiresAt': 1 })
    .limit(limit);

  let expired = 0;

  for (const candidate of due) {
    const session = await mongoose.startSession();
    let timedOutOrder = null;

    try {
      await session.withTransaction(async () => {
        timedOutOrder = await Order.findOneAndUpdate(
          {
            _id: candidate._id,
            status: ORDER_STATUS.PRICE_CONFIRMATION_REQUIRED,
            'priceAdjustment.status':
              PRICE_ADJUSTMENT_STATUS.PENDING_CUSTOMER_APPROVAL,
            'priceAdjustment.approvalExpiresAt': { $lte: now },
          },
          {
            $set: {
              status: ORDER_STATUS.ADMIN_REVIEW_REQUIRED,
              'priceAdjustment.status': PRICE_ADJUSTMENT_STATUS.TIMED_OUT,
              'priceAdjustment.resolvedAt': now,
            },
          },
          { returnDocument: 'after', session, runValidators: true },
        );

        if (!timedOutOrder?.assignedPartnerId) return;

        await Partner.updateOne(
          {
            _id: timedOutOrder.assignedPartnerId,
            activeOrderId: timedOutOrder._id,
          },
          {
            $set: {
              activeOrderId: null,
              availabilityStatus: PARTNER_AVAILABILITY_STATUS.OFFLINE,
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (timedOutOrder) {
      expired += 1;
      emitToCustomer(timedOutOrder.customerId.toString(), 'price:timed-out', {
        orderId: timedOutOrder._id.toString(),
        status: timedOutOrder.status,
      });
      emitToPartner(timedOutOrder.assignedPartnerId?.toString(), 'price:timed-out', {
        orderId: timedOutOrder._id.toString(),
        status: timedOutOrder.status,
      });
    }
  }

  return { expired };
}
