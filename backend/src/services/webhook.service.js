import mongoose from 'mongoose';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { PAYMENT_STATUS } from '../constants/payment.constants.js';
import { Order } from '../models/order.model.js';
import { Payment } from '../models/payment.model.js';
import {
  WEBHOOK_PROCESSING_STATUS,
  WebhookEvent,
} from '../models/webhook-event.model.js';
import { runMatchingForOrder } from './matching.service.js';
import { verifyRazorpayWebhookSignature } from './razorpay.service.js';
import { AppError } from '../utils/app-error.js';

async function finishEvent(eventId, status, extra = {}) {
  await WebhookEvent.updateOne(
    { eventId },
    {
      $set: {
        processingStatus: status,
        processedAt: new Date(),
        ...extra,
      },
    },
  );
}

async function confirmCapturedPayment({ payment, providerPaymentId }) {
  const session = await mongoose.startSession();
  let orderId = payment.orderId;

  try {
    await session.withTransaction(async () => {
      const currentPayment = await Payment.findById(payment._id).session(session);
      if (!currentPayment) return;
      orderId = currentPayment.orderId;

      if (currentPayment.status !== PAYMENT_STATUS.CONFIRMED) {
        await Payment.updateOne(
          { _id: currentPayment._id },
          {
            $set: {
              status: PAYMENT_STATUS.CONFIRMED,
              activeAttempt: false,
              providerPaymentId,
              confirmedAt: currentPayment.confirmedAt ?? new Date(),
              failureReason: null,
              failedAt: null,
            },
          },
          { session, runValidators: true },
        );
      }

      const order = await Order.findById(currentPayment.orderId).session(session);
      if (!order) return;

      if (order.status === ORDER_STATUS.AWAITING_PAYMENT) {
        await Order.updateOne(
          { _id: order._id, status: ORDER_STATUS.AWAITING_PAYMENT },
          { $set: { status: ORDER_STATUS.MATCHING } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const currentOrder = await Order.findById(orderId).select('status');
  if (currentOrder?.status === ORDER_STATUS.MATCHING) {
    try {
      await runMatchingForOrder(orderId);
    } catch (error) {
      console.error('Webhook-confirmed payment could not start matching', {
        orderId: orderId.toString(),
        message: error.message,
      });
    }
  }
}

export async function handleRazorpayWebhook({ rawBody, signature, eventId }) {
  if (!Buffer.isBuffer(rawBody)) {
    throw new AppError('Razorpay webhook requires a raw request body.', {
      statusCode: 400,
      code: 'RAZORPAY_WEBHOOK_RAW_BODY_REQUIRED',
    });
  }

  if (!eventId) {
    throw new AppError('Razorpay event ID header is required.', {
      statusCode: 400,
      code: 'RAZORPAY_EVENT_ID_REQUIRED',
    });
  }

  if (!verifyRazorpayWebhookSignature({ rawBody, signature })) {
    throw new AppError('Invalid Razorpay webhook signature.', {
      statusCode: 400,
      code: 'RAZORPAY_WEBHOOK_SIGNATURE_INVALID',
    });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new AppError('Razorpay webhook payload is not valid JSON.', {
      statusCode: 400,
      code: 'RAZORPAY_WEBHOOK_INVALID_JSON',
    });
  }

  try {
    await WebhookEvent.create({
      provider: 'RAZORPAY',
      eventId,
      eventType: payload.event ?? 'unknown',
    });
  } catch (error) {
    if (error?.code === 11000) {
      return { duplicate: true, processed: true };
    }
    throw error;
  }

  const paymentEntity = payload.payload?.payment?.entity;
  if (!paymentEntity?.order_id || !paymentEntity?.id) {
    await finishEvent(eventId, WEBHOOK_PROCESSING_STATUS.IGNORED);
    return { duplicate: false, processed: false, ignored: true };
  }

  const providerOrderId = paymentEntity.order_id;
  const providerPaymentId = paymentEntity.id;

  await WebhookEvent.updateOne(
    { eventId },
    { $set: { providerOrderId, providerPaymentId } },
  );

  const payment = await Payment.findOne({ providerOrderId });
  if (!payment) {
    await finishEvent(eventId, WEBHOOK_PROCESSING_STATUS.IGNORED);
    return { duplicate: false, processed: false, ignored: true };
  }

  if (Number(paymentEntity.amount) !== payment.amountPaise) {
    await finishEvent(eventId, WEBHOOK_PROCESSING_STATUS.FAILED, {
      errorMessage: 'Provider amount did not match RouteBite payment amount.',
    });
    return { duplicate: false, processed: false, amountMismatch: true };
  }

  if (payload.event === 'payment.captured') {
    await confirmCapturedPayment({ payment, providerPaymentId });
    await finishEvent(eventId, WEBHOOK_PROCESSING_STATUS.PROCESSED);
    return { duplicate: false, processed: true };
  }

  if (payload.event === 'payment.failed') {
    if (payment.status !== PAYMENT_STATUS.CONFIRMED) {
      await Payment.updateOne(
        { _id: payment._id, status: { $ne: PAYMENT_STATUS.CONFIRMED } },
        {
          $set: {
            status: PAYMENT_STATUS.FAILED,
            activeAttempt: false,
            providerPaymentId,
            failedAt: new Date(),
            failureReason: paymentEntity.error_description ?? 'Razorpay reported payment failure.',
          },
        },
      );
    }

    await finishEvent(eventId, WEBHOOK_PROCESSING_STATUS.PROCESSED);
    return { duplicate: false, processed: true };
  }

  await finishEvent(eventId, WEBHOOK_PROCESSING_STATUS.IGNORED);
  return { duplicate: false, processed: false, ignored: true };
}
