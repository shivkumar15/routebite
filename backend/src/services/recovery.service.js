import mongoose from 'mongoose';
import { PRICE_ADJUSTMENT_STATUS } from '../constants/delivery.constants.js';
import { MATCHING_ATTEMPT_STATUS } from '../constants/matching.constants.js';
import { OFFER_STATUS } from '../constants/offer.constants.js';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { PARTNER_AVAILABILITY_STATUS } from '../constants/partner.constants.js';
import {
  CUSTOMER_CANCELLABLE_ORDER_STATUSES,
  PARTNER_POST_PURCHASE_FAILURE_STATUSES,
  PARTNER_REMATCHABLE_ORDER_STATUSES,
  RECOVERY_ACTOR,
  RECOVERY_EVENT,
} from '../constants/recovery.constants.js';
import { MatchingAttempt } from '../models/matching-attempt.model.js';
import { Offer } from '../models/offer.model.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { getSocketServer } from '../socket/index.js';
import { AppError } from '../utils/app-error.js';
import { startOrDeferMatching } from './matching-orchestration.service.js';

function emitToCustomer(customerId, eventName, payload) {
  if (!customerId) return;
  getSocketServer()?.to(`user:${customerId}`).emit(eventName, payload);
}

function emitToPartnerUser(userId, eventName, payload) {
  if (!userId) return;
  getSocketServer()?.to(`user:${userId}`).emit(eventName, payload);
}

function normalizedReason(reason, fallback) {
  const value = typeof reason === 'string' ? reason.trim() : '';
  return value || fallback;
}

function resetPrePurchasePrice(order) {
  order.pricing.finalCustomerTotalPaise = null;
  order.priceAdjustment = {
    status: PRICE_ADJUSTMENT_STATUS.NONE,
    actualFoodCostPaise: null,
    differencePaise: null,
    receiptAssetId: null,
    reportedAt: null,
    approvalExpiresAt: null,
    resolvedAt: null,
  };
}

async function cancelPendingOffers(orderId, now, session) {
  await Offer.updateMany(
    { orderId, status: OFFER_STATUS.PENDING },
    { $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now } },
    { session },
  );
}

export async function cancelCustomerOrder({ customerId, orderId, reason }, now = new Date()) {
  const session = await mongoose.startSession();
  let result = null;
  let partnerUserId = null;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, customerId }).session(session);
      if (!order) {
        throw new AppError('Order not found.', { statusCode: 404, code: 'ORDER_NOT_FOUND' });
      }

      if (!CUSTOMER_CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
        throw new AppError(
          order.pickedUpAt
            ? 'This order can no longer be cancelled automatically because the food has already been picked up.'
            : 'This order cannot be cancelled from its current state.',
          {
            statusCode: 409,
            code: order.pickedUpAt ? 'CANCELLATION_AFTER_PURCHASE_REQUIRES_REVIEW' : 'ORDER_NOT_CANCELLABLE',
          },
        );
      }

      const assignedPartnerId = order.assignedPartnerId;
      if (assignedPartnerId) {
        const partner = await Partner.findById(assignedPartnerId).session(session);
        partnerUserId = partner?.userId?.toString() ?? null;
        await Partner.updateOne(
          { _id: assignedPartnerId, activeOrderId: order._id },
          {
            $set: {
              activeOrderId: null,
              availabilityStatus: PARTNER_AVAILABILITY_STATUS.OFFLINE,
            },
          },
          { session },
        );
      }

      if (
        order.priceAdjustment?.status === PRICE_ADJUSTMENT_STATUS.PENDING_CUSTOMER_APPROVAL
      ) {
        order.priceAdjustment.status = PRICE_ADJUSTMENT_STATUS.REJECTED;
        order.priceAdjustment.resolvedAt = now;
      }

      order.status = ORDER_STATUS.CANCELLED;
      order.recovery.lastEvent = RECOVERY_EVENT.CUSTOMER_CANCELLED_BEFORE_PURCHASE;
      order.recovery.lastActor = RECOVERY_ACTOR.CUSTOMER;
      order.recovery.reason = normalizedReason(reason, 'Customer cancelled before food pickup.');
      order.recovery.occurredAt = now;
      await order.save({ session });

      await cancelPendingOffers(order._id, now, session);
      await MatchingAttempt.deleteMany(
        {
          orderId: order._id,
          status: MATCHING_ATTEMPT_STATUS.WAITING_FOR_HORIZON,
        },
        { session },
      );

      result = order;
    });
  } finally {
    await session.endSession();
  }

  const payload = {
    orderId: result._id.toString(),
    status: result.status,
    recovery: {
      event: result.recovery.lastEvent,
      reason: result.recovery.reason,
      occurredAt: result.recovery.occurredAt,
    },
  };
  emitToCustomer(result.customerId.toString(), 'order:cancelled', payload);
  emitToPartnerUser(partnerUserId, 'order:cancelled', payload);

  return result;
}

export async function reportPartnerCannotComplete({ partnerId, reason }, now = new Date()) {
  const session = await mongoose.startSession();
  let result = null;
  let partnerUserId = null;
  let shouldRematch = false;

  try {
    await session.withTransaction(async () => {
      const partner = await Partner.findById(partnerId).session(session);
      if (!partner?.activeOrderId) {
        throw new AppError('You do not have an active delivery.', {
          statusCode: 409,
          code: 'ACTIVE_ORDER_REQUIRED',
        });
      }
      partnerUserId = partner.userId.toString();

      const order = await Order.findOne({
        _id: partner.activeOrderId,
        assignedPartnerId: partner._id,
      }).session(session);
      if (!order) {
        throw new AppError('Active order reference is inconsistent.', {
          statusCode: 409,
          code: 'ACTIVE_ORDER_INCONSISTENT',
        });
      }

      const recoveryReason = normalizedReason(reason, 'Partner reported that they cannot complete this delivery.');

      if (PARTNER_REMATCHABLE_ORDER_STATUSES.includes(order.status)) {
        shouldRematch = true;
        const excluded = new Set(
          (order.recovery?.excludedPartnerIds ?? []).map((id) => id.toString()),
        );
        excluded.add(partner._id.toString());

        order.status = ORDER_STATUS.MATCHING;
        order.assignedPartnerId = null;
        order.assignedTripId = null;
        order.pickupStartedAt = null;
        resetPrePurchasePrice(order);
        order.recovery.lastEvent = RECOVERY_EVENT.PARTNER_CANCELLED_BEFORE_PURCHASE;
        order.recovery.lastActor = RECOVERY_ACTOR.PARTNER;
        order.recovery.reason = recoveryReason;
        order.recovery.occurredAt = now;
        order.recovery.rematchCount = (order.recovery.rematchCount ?? 0) + 1;
        order.recovery.excludedPartnerIds = [...excluded];
        await order.save({ session });
      } else if (PARTNER_POST_PURCHASE_FAILURE_STATUSES.includes(order.status)) {
        order.status = ORDER_STATUS.ADMIN_REVIEW_REQUIRED;
        order.recovery.lastEvent = RECOVERY_EVENT.PARTNER_FAILED_AFTER_PURCHASE;
        order.recovery.lastActor = RECOVERY_ACTOR.PARTNER;
        order.recovery.reason = recoveryReason;
        order.recovery.occurredAt = now;
        await order.save({ session });
      } else {
        throw new AppError('This delivery cannot enter partner recovery from its current state.', {
          statusCode: 409,
          code: 'PARTNER_RECOVERY_NOT_ALLOWED',
        });
      }

      await Partner.updateOne(
        { _id: partner._id, activeOrderId: order._id },
        {
          $set: {
            activeOrderId: null,
            availabilityStatus: PARTNER_AVAILABILITY_STATUS.OFFLINE,
          },
          $inc: { cancelledOrderCount: 1 },
        },
        { session },
      );
      await cancelPendingOffers(order._id, now, session);
      result = order;
    });
  } finally {
    await session.endSession();
  }

  const initialPayload = {
    orderId: result._id.toString(),
    status: result.status,
    recovery: {
      event: result.recovery.lastEvent,
      reason: result.recovery.reason,
      occurredAt: result.recovery.occurredAt,
      rematchCount: result.recovery.rematchCount ?? 0,
    },
  };
  emitToCustomer(
    result.customerId.toString(),
    shouldRematch ? 'order:rematching' : 'order:admin-review-required',
    initialPayload,
  );
  emitToPartnerUser(partnerUserId, 'order:released', initialPayload);

  let matching = null;
  if (shouldRematch) {
    try {
      matching = await startOrDeferMatching(result._id, now);
    } catch (error) {
      await Order.updateOne(
        { _id: result._id, status: ORDER_STATUS.MATCHING, assignedPartnerId: null },
        {
          $set: {
            status: ORDER_STATUS.ADMIN_REVIEW_REQUIRED,
            'recovery.lastEvent': RECOVERY_EVENT.PARTNER_CANCELLED_BEFORE_PURCHASE,
            'recovery.lastActor': RECOVERY_ACTOR.SYSTEM,
            'recovery.reason': `Automatic rematch could not start: ${error.message}`,
            'recovery.occurredAt': new Date(),
          },
        },
      );
      throw new AppError('The partner was released, but automatic rematching could not start. The order needs review.', {
        statusCode: 503,
        code: 'REMATCH_START_FAILED',
      });
    }
  }

  const current = await Order.findById(result._id);
  return { order: current, rematching: shouldRematch, matching };
}
