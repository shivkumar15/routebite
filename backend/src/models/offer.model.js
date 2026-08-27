import mongoose from 'mongoose';
import { MATCHING_PARTNER_MODE } from '../constants/matching.constants.js';
import { OFFER_STATUS } from '../constants/offer.constants.js';

const offerSchema = new mongoose.Schema(
  {
    matchingAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MatchingAttempt',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
    partnerMode: {
      type: String,
      enum: Object.values(MATCHING_PARTNER_MODE),
      required: true,
    },
    round: {
      type: Number,
      required: true,
      min: 1,
    },
    rankPosition: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(OFFER_STATUS),
      default: OFFER_STATUS.PENDING,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    predictedPickupAt: {
      type: Date,
      required: true,
    },
    predictedDeliveryAt: {
      type: Date,
      required: true,
    },
    additionalDetourSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    additionalDetourMeters: {
      type: Number,
      default: null,
      min: 0,
    },
    expectedEarningPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Offer earning must be integer paise.',
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

offerSchema.index({ matchingAttemptId: 1, partnerId: 1 }, { unique: true });
offerSchema.index({ partnerId: 1, status: 1, expiresAt: 1 });
offerSchema.index({ orderId: 1, status: 1, createdAt: 1 });
offerSchema.index(
  { orderId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: OFFER_STATUS.ACCEPTED },
  },
);

export const Offer = mongoose.model('Offer', offerSchema);
