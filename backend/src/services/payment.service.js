import mongoose from 'mongoose';
import { ORDER_STATUS } from '../constants/order.constants.js';
import {
  ACTIVE_PAYMENT_STATUSES,
  PAYMENT_STATUS,
} from '../constants/payment.constants.js';
import { Order } from '../models/order.model.js';
import { Payment } from '../models/payment.model.js';
import { runMatchingForOrder } from './matching.service.js';
import { calculateCheckoutPricing } from './pricing.service.js';
import {
  createRazorpayOrder,
  getRazorpayCheckoutKeyId,
  verifyRazorpayPaymentSignature,
} from './razorpay.service.js';
import { AppError } from '../utils/app-error.js';

function toSafePayment(payment) {
  if (!payment) return null;

  return {
    id: payment._id.toString(),
    orderId: payment.orderId.toString(),
    provider: payment.provider,
    mode: payment.mode,
    currency: payment.currency,
    status: payment.status,
    amountPaise: payment.amountPaise,
    providerOrderId: payment.providerOrderId,
    providerPaymentId: payment.providerPaymentId,
    confirmedAt: payment.confirmedAt,
    failedAt: payment.failedAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function checkoutPayload(payment) {
  return {
    payment: toSafePayment(payment),
    checkout:
      payment.providerOrderId && ACTIVE_PAYMENT_STATUSES.includes(payment.status)
        ? {
            keyId: getRazorpayCheckoutKeyId(),
            providerOrderId: payment.providerOrderId,
            amountPaise: payment.amountPaise,
            currency: payment.currency,
            name: 'RouteBite',
            description: 'RouteBite test payment',
          }
        : null,
  };
}

async function getOwnedOrder({ customerId, orderId, session = null }) {
  let query = Order.findOne({ _id: orderId, customerId });
  if (session) query = query.session(session);
  const order = await query;

  if (!order) {
    throw new AppError('Order not found.', {
      statusCode: 404,
      code: 'ORDER_NOT_FOUND',
    });
  }

  return order;
}

async function getReusableActivePayment(orderId) {
  return Payment.findOne({
    orderId,
    activeAttempt: true,
    status: { $in: ACTIVE_PAYMENT_STATUSES },
  }).sort({ createdAt: -1 });
}

async function failPaymentAttempt(paymentId, reason) {
  await Payment.updateOne(
    { _id: paymentId, activeAttempt: true },
    {
      $set: {
        status: PAYMENT_STATUS.FAILED,
        activeAttempt: false,
        failedAt: new Date(),
        failureReason: reason,
      },
    },
  );
}

async function runMatchingSafely(orderId) {
  try {
    return await runMatchingForOrder(orderId);
  } catch (error) {
    console.error('Automatic matching failed after payment confirmation', {
      orderId: orderId.toString(),
      message: error.message,
    });
    return null;
  }
}

async function paymentConfirmationResponse(payment, orderId) {
  const matching = await runMatchingSafely(orderId);
  const currentOrder = await Order.findById(orderId).select('status');
  return {
    payment: toSafePayment(payment),
    orderStatus: currentOrder?.status ?? ORDER_STATUS.MATCHING,
    matching,
  };
}

export async function createOrReusePaymentAttempt({ customerId, orderId, idempotencyKey }) {
  const order = await getOwnedOrder({ customerId, orderId });

  const existingByKey = await Payment.findOne({ idempotencyKey });
  if (existingByKey) {
    if (
      existingByKey.orderId.toString() !== order._id.toString() ||
      existingByKey.customerId.toString() !== customerId.toString()
    ) {
      throw new AppError('This idempotency key has already been used for another payment.', {
        statusCode: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
      });
    }

    return checkoutPayload(existingByKey);
  }

  if (order.status === ORDER_STATUS.MATCHING) {
    const confirmed = await Payment.findOne({
      orderId: order._id,
      customerId,
      status: PAYMENT_STATUS.CONFIRMED,
    }).sort({ confirmedAt: -1 });

    if (confirmed) return checkoutPayload(confirmed);
  }

  if (![ORDER_STATUS.DRAFT, ORDER_STATUS.AWAITING_PAYMENT].includes(order.status)) {
    throw new AppError('This order is not currently payable.', {
      statusCode: 409,
      code: 'ORDER_NOT_PAYABLE',
    });
  }

  const reusable = await getReusableActivePayment(order._id);
  if (reusable) return checkoutPayload(reusable);

  const pricing = calculateCheckoutPricing(order.pricing.estimatedFoodCostPaise);
  let payment;

  try {
    payment = await Payment.create({
      orderId: order._id,
      customerId,
      amountPaise: pricing.estimatedCustomerTotalPaise,
      idempotencyKey,
      status: PAYMENT_STATUS.CREATED,
      activeAttempt: true,
    });
  } catch (error) {
    if (error?.code === 11000) {
      const concurrent = await getReusableActivePayment(order._id);
      if (concurrent) return checkoutPayload(concurrent);
    }
    throw error;
  }

  const receipt = `rb_${payment._id.toString()}`;
  let providerOrder;

  try {
    providerOrder = await createRazorpayOrder({
      amountPaise: pricing.estimatedCustomerTotalPaise,
      receipt,
      orderId: order._id.toString(),
    });
  } catch (error) {
    await failPaymentAttempt(payment._id, error.message);
    throw error;
  }

  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: payment._id, activeAttempt: true, status: PAYMENT_STATUS.CREATED },
    {
      $set: {
        status: PAYMENT_STATUS.PENDING,
        providerOrderId: providerOrder.id,
        providerReceipt: providerOrder.receipt ?? receipt,
      },
    },
    { new: true, runValidators: true },
  );

  if (!updatedPayment) {
    throw new AppError('The payment attempt changed while checkout was being prepared.', {
      statusCode: 409,
      code: 'PAYMENT_STATE_CONFLICT',
    });
  }

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      customerId,
      status: { $in: [ORDER_STATUS.DRAFT, ORDER_STATUS.AWAITING_PAYMENT] },
    },
    {
      $set: {
        status: ORDER_STATUS.AWAITING_PAYMENT,
        'pricing.customerDeliveryChargePaise': pricing.customerDeliveryChargePaise,
        'pricing.partnerBaseEarningPaise': pricing.partnerBaseEarningPaise,
        'pricing.platformFeePaise': pricing.platformFeePaise,
        'pricing.estimatedCustomerTotalPaise': pricing.estimatedCustomerTotalPaise,
      },
    },
    { new: true, runValidators: true },
  );

  if (!updatedOrder) {
    await failPaymentAttempt(updatedPayment._id, 'Order was no longer payable.');
    throw new AppError('The order changed while checkout was being prepared.', {
      statusCode: 409,
      code: 'ORDER_PAYMENT_STATE_CONFLICT',
    });
  }

  return checkoutPayload(updatedPayment);
}

export async function verifyAndConfirmPayment({
  customerId,
  orderId,
  providerOrderId,
  providerPaymentId,
  providerSignature,
}) {
  await getOwnedOrder({ customerId, orderId });

  const payment = await Payment.findOne({
    orderId,
    customerId,
    providerOrderId,
  });

  if (!payment) {
    throw new AppError('Payment attempt not found.', {
      statusCode: 404,
      code: 'PAYMENT_NOT_FOUND',
    });
  }

  if (payment.status === PAYMENT_STATUS.CONFIRMED) {
    if (payment.providerPaymentId && payment.providerPaymentId !== providerPaymentId) {
      throw new AppError('This RouteBite payment was already confirmed with another provider payment.', {
        statusCode: 409,
        code: 'PAYMENT_ALREADY_CONFIRMED',
      });
    }
    return paymentConfirmationResponse(payment, orderId);
  }

  if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status) || !payment.activeAttempt) {
    throw new AppError('This payment attempt is no longer active.', {
      statusCode: 409,
      code: 'PAYMENT_NOT_ACTIVE',
    });
  }

  const validSignature = verifyRazorpayPaymentSignature({
    providerOrderId: payment.providerOrderId,
    providerPaymentId,
    providerSignature,
  });

  if (!validSignature) {
    throw new AppError('Razorpay payment signature verification failed.', {
      statusCode: 400,
      code: 'PAYMENT_SIGNATURE_INVALID',
    });
  }

  const session = await mongoose.startSession();
  let confirmedPayment;

  try {
    await session.withTransaction(async () => {
      const currentPayment = await Payment.findOne({ _id: payment._id }).session(session);

      if (currentPayment.status === PAYMENT_STATUS.CONFIRMED) {
        confirmedPayment = currentPayment;
        return;
      }

      if (!ACTIVE_PAYMENT_STATUSES.includes(currentPayment.status) || !currentPayment.activeAttempt) {
        throw new AppError('This payment attempt is no longer active.', {
          statusCode: 409,
          code: 'PAYMENT_NOT_ACTIVE',
        });
      }

      const order = await getOwnedOrder({ customerId, orderId, session });
      if (![ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.MATCHING].includes(order.status)) {
        throw new AppError('Order is not waiting for this payment.', {
          statusCode: 409,
          code: 'ORDER_PAYMENT_STATE_CONFLICT',
        });
      }

      confirmedPayment = await Payment.findOneAndUpdate(
        { _id: currentPayment._id, activeAttempt: true },
        {
          $set: {
            status: PAYMENT_STATUS.CONFIRMED,
            activeAttempt: false,
            providerPaymentId,
            providerSignature,
            confirmedAt: new Date(),
          },
        },
        { new: true, runValidators: true, session },
      );

      if (!confirmedPayment) {
        throw new AppError('Payment confirmation conflicted with another request.', {
          statusCode: 409,
          code: 'PAYMENT_CONFIRMATION_CONFLICT',
        });
      }

      if (order.status === ORDER_STATUS.AWAITING_PAYMENT) {
        const moved = await Order.updateOne(
          { _id: order._id, customerId, status: ORDER_STATUS.AWAITING_PAYMENT },
          { $set: { status: ORDER_STATUS.MATCHING } },
          { session },
        );

        if (moved.modifiedCount !== 1) {
          throw new AppError('Order could not enter matching after payment confirmation.', {
            statusCode: 409,
            code: 'ORDER_MATCHING_TRANSITION_CONFLICT',
          });
        }
      }
    });
  } finally {
    await session.endSession();
  }

  return paymentConfirmationResponse(confirmedPayment, orderId);
}

export async function getLatestCustomerPayment({ customerId, orderId }) {
  await getOwnedOrder({ customerId, orderId });
  const payment = await Payment.findOne({ orderId, customerId }).sort({ createdAt: -1 });
  return toSafePayment(payment);
}
