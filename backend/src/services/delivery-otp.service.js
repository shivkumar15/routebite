import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { DELIVERY_OPERATION_LIMITS } from '../constants/delivery.constants.js';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { PARTNER_AVAILABILITY_STATUS } from '../constants/partner.constants.js';
import { Order } from '../models/order.model.js';
import { PartnerEarning } from '../models/partner-earning.model.js';
import { Partner } from '../models/partner.model.js';
import { getSocketServer } from '../socket/index.js';
import { AppError } from '../utils/app-error.js';

function emitToUser(userId, eventName, payload) {
  if (!userId) return;
  getSocketServer()?.to(`user:${userId}`).emit(eventName, payload);
}

function hashOtp(orderId, otp) {
  return createHmac('sha256', env.jwtSecret)
    .update(`delivery-otp:${orderId}:${otp}`)
    .digest('hex');
}

function hashesEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function generateOtpValue() {
  const digits = DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_DIGITS;
  const min = 10 ** (digits - 1);
  const max = 10 ** digits;
  return String(randomInt(min, max));
}

async function requirePartnerActiveOrder(partnerId, session = null) {
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
  }).select('+deliveryOtp.hash');
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

export async function requestDeliveryOtp({ partnerId }, now = new Date()) {
  const { partner, order } = await requirePartnerActiveOrder(partnerId);

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      assignedPartnerId: partner._id,
      status: ORDER_STATUS.OUT_FOR_DELIVERY,
    },
    {
      $set: {
        status: ORDER_STATUS.DELIVERY_OTP_REQUIRED,
        deliveryOtpRequestedAt: now,
        'deliveryOtp.hash': null,
        'deliveryOtp.generatedAt': null,
        'deliveryOtp.expiresAt': null,
        'deliveryOtp.attempts': 0,
        'deliveryOtp.usedAt': null,
      },
    },
    { returnDocument: 'after', runValidators: true },
  );

  if (!updated) {
    throw new AppError('Delivery OTP can only be requested while the order is out for delivery.', {
      statusCode: 409,
      code: 'DELIVERY_OTP_REQUEST_CONFLICT',
    });
  }

  emitToUser(updated.customerId.toString(), 'order:delivery-otp-required', {
    orderId: updated._id.toString(),
    status: updated.status,
    requestedAt: updated.deliveryOtpRequestedAt,
  });

  return updated;
}

export async function generateCustomerDeliveryOtp({ customerId, orderId }, now = new Date()) {
  const otp = generateOtpValue();
  const expiresAt = new Date(
    now.getTime() + DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_EXPIRY_MINUTES * 60 * 1000,
  );
  const hash = hashOtp(orderId, otp);

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      customerId,
      status: ORDER_STATUS.DELIVERY_OTP_REQUIRED,
      assignedPartnerId: { $ne: null },
    },
    {
      $set: {
        'deliveryOtp.hash': hash,
        'deliveryOtp.generatedAt': now,
        'deliveryOtp.expiresAt': expiresAt,
        'deliveryOtp.attempts': 0,
        'deliveryOtp.usedAt': null,
      },
    },
    { returnDocument: 'after', runValidators: true },
  );

  if (!order) {
    const exists = await Order.exists({ _id: orderId, customerId });
    throw new AppError(
      exists
        ? 'A delivery OTP can only be generated after the partner reaches the drop.'
        : 'Order not found.',
      {
        statusCode: exists ? 409 : 404,
        code: exists ? 'DELIVERY_OTP_NOT_REQUIRED' : 'ORDER_NOT_FOUND',
      },
    );
  }

  const partner = await Partner.findById(order.assignedPartnerId).select('userId');
  emitToUser(partner?.userId?.toString(), 'delivery:otp-generated', {
    orderId: order._id.toString(),
    status: order.status,
    expiresAt,
  });

  return {
    otp,
    generatedAt: now,
    expiresAt,
    maxAttempts: DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_MAX_ATTEMPTS,
  };
}

export async function verifyDeliveryOtpAndComplete({ partnerId, otp }, now = new Date()) {
  const session = await mongoose.startSession();
  let completed = null;
  let customerId = null;
  let partnerUserId = null;
  let deferredError = null;

  try {
    await session.withTransaction(async () => {
      const { partner, order } = await requirePartnerActiveOrder(partnerId, session);
      customerId = order.customerId.toString();
      partnerUserId = partner.userId.toString();

      if (order.status !== ORDER_STATUS.DELIVERY_OTP_REQUIRED) {
        deferredError = new AppError('This delivery is not waiting for OTP confirmation.', {
          statusCode: 409,
          code: 'DELIVERY_OTP_NOT_REQUIRED',
        });
        return;
      }

      const otpState = order.deliveryOtp ?? {};
      if (!otpState.hash || !otpState.generatedAt || !otpState.expiresAt) {
        deferredError = new AppError('The customer has not generated a delivery OTP yet.', {
          statusCode: 409,
          code: 'DELIVERY_OTP_NOT_GENERATED',
        });
        return;
      }

      if (otpState.usedAt) {
        deferredError = new AppError('This delivery OTP has already been used.', {
          statusCode: 409,
          code: 'DELIVERY_OTP_ALREADY_USED',
        });
        return;
      }

      if (otpState.expiresAt.getTime() <= now.getTime()) {
        deferredError = new AppError('The delivery OTP has expired. Ask the customer to generate a new one.', {
          statusCode: 409,
          code: 'DELIVERY_OTP_EXPIRED',
        });
        return;
      }

      if (otpState.attempts >= DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_MAX_ATTEMPTS) {
        deferredError = new AppError('Too many incorrect attempts. Ask the customer to generate a new OTP.', {
          statusCode: 409,
          code: 'DELIVERY_OTP_ATTEMPTS_EXCEEDED',
        });
        return;
      }

      const submittedHash = hashOtp(order._id.toString(), String(otp));
      if (!hashesEqual(otpState.hash, submittedHash)) {
        await Order.updateOne(
          {
            _id: order._id,
            status: ORDER_STATUS.DELIVERY_OTP_REQUIRED,
            'deliveryOtp.hash': otpState.hash,
          },
          { $inc: { 'deliveryOtp.attempts': 1 } },
          { session },
        );
        deferredError = new AppError('The delivery OTP is incorrect.', {
          statusCode: 422,
          code: 'DELIVERY_OTP_INCORRECT',
          details: {
            attemptsRemaining: Math.max(
              0,
              DELIVERY_OPERATION_LIMITS.DELIVERY_OTP_MAX_ATTEMPTS - otpState.attempts - 1,
            ),
          },
        });
        return;
      }

      const deliveredResult = await Order.updateOne(
        {
          _id: order._id,
          assignedPartnerId: partner._id,
          status: ORDER_STATUS.DELIVERY_OTP_REQUIRED,
          'deliveryOtp.hash': otpState.hash,
          'deliveryOtp.usedAt': null,
        },
        {
          $set: {
            status: ORDER_STATUS.DELIVERED,
            'deliveryOtp.usedAt': now,
            deliveredAt: now,
          },
        },
        { session },
      );

      if (deliveredResult.modifiedCount !== 1) {
        deferredError = new AppError('Delivery confirmation changed before completion.', {
          statusCode: 409,
          code: 'DELIVERY_COMPLETION_CONFLICT',
        });
        return;
      }

      const baseEarningPaise = order.pricing.partnerBaseEarningPaise;
      await PartnerEarning.updateOne(
        { orderId: order._id },
        {
          $setOnInsert: {
            orderId: order._id,
            partnerId: partner._id,
            baseEarningPaise,
            incentivePaise: 0,
            totalEarningPaise: baseEarningPaise,
            earnedAt: now,
          },
        },
        { upsert: true, session, runValidators: true },
      );

      const partnerResult = await Partner.updateOne(
        { _id: partner._id, activeOrderId: order._id },
        {
          $set: {
            activeOrderId: null,
            availabilityStatus: PARTNER_AVAILABILITY_STATUS.OFFLINE,
          },
          $inc: { completedOrderCount: 1 },
        },
        { session },
      );

      if (partnerResult.modifiedCount !== 1) {
        throw new AppError('Partner active delivery changed during completion.', {
          statusCode: 409,
          code: 'PARTNER_COMPLETION_CONFLICT',
        });
      }

      const completedOrder = await Order.findOneAndUpdate(
        { _id: order._id, status: ORDER_STATUS.DELIVERED },
        { $set: { status: ORDER_STATUS.COMPLETED, completedAt: now } },
        { returnDocument: 'after', session, runValidators: true },
      );

      if (!completedOrder) {
        throw new AppError('Order could not be finalized after delivery confirmation.', {
          statusCode: 409,
          code: 'ORDER_FINALIZATION_CONFLICT',
        });
      }

      completed = {
        id: completedOrder._id.toString(),
        status: completedOrder.status,
        deliveredAt: completedOrder.deliveredAt,
        completedAt: completedOrder.completedAt,
        earningPaise: baseEarningPaise,
      };
    });
  } finally {
    await session.endSession();
  }

  if (deferredError) throw deferredError;
  if (!completed) {
    throw new AppError('Delivery could not be completed.', {
      statusCode: 409,
      code: 'DELIVERY_COMPLETION_FAILED',
    });
  }

  const event = {
    orderId: completed.id,
    status: completed.status,
    deliveredAt: completed.deliveredAt,
    completedAt: completed.completedAt,
  };
  emitToUser(customerId, 'order:completed', event);
  emitToUser(partnerUserId, 'order:completed', event);

  return completed;
}

export { hashOtp };
