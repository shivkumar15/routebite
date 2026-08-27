import mongoose from 'mongoose';
import {
  PARTNER_AVAILABILITY_STATUS,
  PARTNER_VERIFICATION_STATUS,
} from '../constants/partner.constants.js';

const collegeIdentitySchema = new mongoose.Schema(
  {
    enrollmentNumber: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    collegeName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    documentAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadAsset',
      required: true,
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  { _id: false },
);

const partnerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(PARTNER_VERIFICATION_STATUS),
      default: PARTNER_VERIFICATION_STATUS.PENDING,
      index: true,
    },
    profilePhotoAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadAsset',
      required: true,
    },
    collegeIdentity: {
      type: collegeIdentitySchema,
      required: true,
    },
    availabilityStatus: {
      type: String,
      enum: Object.values(PARTNER_AVAILABILITY_STATUS),
      default: PARTNER_AVAILABILITY_STATUS.OFFLINE,
    },
    activeOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    completedOrderCount: { type: Number, default: 0, min: 0 },
    cancelledOrderCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

partnerSchema.index({ verificationStatus: 1, createdAt: 1 });
partnerSchema.index({ activeOrderId: 1 });

export const Partner = mongoose.model('Partner', partnerSchema);
