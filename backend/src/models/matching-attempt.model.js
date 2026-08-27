import mongoose from 'mongoose';
import {
  MATCHING_ATTEMPT_STATUS,
  MATCHING_PARTNER_MODE,
} from '../constants/matching.constants.js';

const candidateSchema = new mongoose.Schema(
  {
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
    mode: { type: String, enum: Object.values(MATCHING_PARTNER_MODE), required: true },
    routeSource: { type: String, required: true },
    predictedPickupAt: { type: Date, required: true },
    predictedDeliveryAt: { type: Date, required: true },
    pickupTravelSeconds: { type: Number, required: true, min: 0 },
    totalDeliveryTravelSeconds: { type: Number, required: true, min: 0 },
    additionalDetourSeconds: { type: Number, default: null, min: 0 },
    additionalDetourMeters: { type: Number, default: null, min: 0 },
    pickupDistanceMeters: { type: Number, required: true, min: 0 },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    completedOrderCount: { type: Number, default: 0, min: 0 },
    rankPosition: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const matchingAttemptSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: Object.values(MATCHING_ATTEMPT_STATUS),
      default: MATCHING_ATTEMPT_STATUS.RUNNING,
      required: true,
      index: true,
    },
    routeSource: { type: String, default: null },
    discoveredCandidateCount: { type: Number, default: 0, min: 0 },
    eligibleCandidateCount: { type: Number, default: 0, min: 0 },
    candidates: { type: [candidateSchema], default: [] },
    offerReadyPartnerIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Partner' }],
      default: [],
    },
    rejectionSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
    failureReason: { type: String, default: null, maxlength: 500 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

matchingAttemptSchema.index({ orderId: 1, attemptNumber: 1 }, { unique: true });
matchingAttemptSchema.index({ orderId: 1, createdAt: -1 });
matchingAttemptSchema.index(
  { orderId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: MATCHING_ATTEMPT_STATUS.RUNNING },
  },
);

export const MatchingAttempt = mongoose.model('MatchingAttempt', matchingAttemptSchema);
