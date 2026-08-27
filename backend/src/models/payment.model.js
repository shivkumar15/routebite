import mongoose from 'mongoose';
import {
  PAYMENT_CURRENCY,
  PAYMENT_MODE,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
} from '../constants/payment.constants.js';

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: Object.values(PAYMENT_PROVIDER),
      default: PAYMENT_PROVIDER.RAZORPAY,
      required: true,
    },
    mode: {
      type: String,
      enum: Object.values(PAYMENT_MODE),
      default: PAYMENT_MODE.TEST,
      required: true,
    },
    currency: {
      type: String,
      default: PAYMENT_CURRENCY,
      enum: [PAYMENT_CURRENCY],
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.CREATED,
      required: true,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Payment amount must be an integer number of paise.',
      },
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 120,
      unique: true,
      index: true,
    },
    providerOrderId: {
      type: String,
      trim: true,
      default: null,
    },
    providerPaymentId: {
      type: String,
      trim: true,
      default: null,
    },
    providerSignature: {
      type: String,
      trim: true,
      default: null,
    },
    providerReceipt: {
      type: String,
      trim: true,
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    confirmedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

paymentSchema.index(
  { providerOrderId: 1 },
  { unique: true, partialFilterExpression: { providerOrderId: { $type: 'string' } } },
);
paymentSchema.index(
  { providerPaymentId: 1 },
  { unique: true, partialFilterExpression: { providerPaymentId: { $type: 'string' } } },
);
paymentSchema.index({ orderId: 1, createdAt: -1 });
paymentSchema.index({ customerId: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
