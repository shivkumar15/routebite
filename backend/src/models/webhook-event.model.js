import mongoose from 'mongoose';

const WEBHOOK_PROCESSING_STATUS = Object.freeze({
  RECEIVED: 'RECEIVED',
  PROCESSED: 'PROCESSED',
  IGNORED: 'IGNORED',
  FAILED: 'FAILED',
});

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['RAZORPAY'],
      required: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
      maxlength: 180,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    processingStatus: {
      type: String,
      enum: Object.values(WEBHOOK_PROCESSING_STATUS),
      default: WEBHOOK_PROCESSING_STATUS.RECEIVED,
      required: true,
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
    errorMessage: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    processedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

webhookEventSchema.index({ provider: 1, createdAt: -1 });

export { WEBHOOK_PROCESSING_STATUS };
export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
