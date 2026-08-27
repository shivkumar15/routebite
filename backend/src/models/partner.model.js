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

const geoPointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            Number.isFinite(value[0]) &&
            Number.isFinite(value[1]) &&
            value[0] >= -180 &&
            value[0] <= 180 &&
            value[1] >= -90 &&
            value[1] <= 90
          );
        },
        message: 'GeoJSON coordinates must be [longitude, latitude].',
      },
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
    currentLocation: {
      type: geoPointSchema,
      default: null,
    },
    locationAccuracyMeters: {
      type: Number,
      default: null,
      min: 0,
      max: 10000,
    },
    locationUpdatedAt: {
      type: Date,
      default: null,
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

partnerSchema.index({ currentLocation: '2dsphere' });
partnerSchema.index({ verificationStatus: 1, availabilityStatus: 1 });
partnerSchema.index({ verificationStatus: 1, createdAt: 1 });
partnerSchema.index({ activeOrderId: 1 });

export const Partner = mongoose.model('Partner', partnerSchema);
