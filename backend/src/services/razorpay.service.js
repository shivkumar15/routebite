import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env.js';
import { PAYMENT_CURRENCY } from '../constants/payment.constants.js';
import { AppError } from '../utils/app-error.js';

const RAZORPAY_API_BASE_URL = 'https://api.razorpay.com/v1';

function requireRazorpayKeys() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new AppError('Razorpay Test Mode is not configured on the server.', {
      statusCode: 503,
      code: 'RAZORPAY_NOT_CONFIGURED',
    });
  }
}

export async function createRazorpayOrder({ amountPaise, receipt, orderId }) {
  requireRazorpayKeys();

  try {
    const { data } = await axios.post(
      `${RAZORPAY_API_BASE_URL}/orders`,
      {
        amount: amountPaise,
        currency: PAYMENT_CURRENCY,
        receipt,
        notes: {
          routebiteOrderId: orderId,
          mode: 'TEST',
        },
      },
      {
        auth: {
          username: env.razorpay.keyId,
          password: env.razorpay.keySecret,
        },
        timeout: 10000,
      },
    );

    return {
      id: data.id,
      amountPaise: data.amount,
      currency: data.currency,
      status: data.status,
      receipt: data.receipt,
    };
  } catch (error) {
    const providerMessage =
      error.response?.data?.error?.description ??
      error.response?.data?.error?.reason ??
      'Razorpay could not create a test order.';

    throw new AppError(providerMessage, {
      statusCode: 502,
      code: 'RAZORPAY_ORDER_CREATE_FAILED',
    });
  }
}

export function verifyRazorpayPaymentSignature({
  providerOrderId,
  providerPaymentId,
  providerSignature,
}) {
  requireRazorpayKeys();

  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest('hex');

  if (!/^[a-f0-9]{64}$/i.test(providerSignature)) return false;

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(providerSignature, 'hex');

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function getRazorpayCheckoutKeyId() {
  requireRazorpayKeys();
  return env.razorpay.keyId;
}

export function verifyRazorpayWebhookSignature({ rawBody, signature }) {
  if (!env.razorpay.webhookSecret) {
    throw new AppError('Razorpay webhook verification is not configured.', {
      statusCode: 503,
      code: 'RAZORPAY_WEBHOOK_NOT_CONFIGURED',
    });
  }

  const expected = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (!/^[a-f0-9]{64}$/i.test(signature ?? '')) return false;

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
