import mongoose from 'mongoose';
import { UPLOAD_PURPOSE } from '../constants/partner.constants.js';

const uploadAssetSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: Object.values(UPLOAD_PURPOSE),
      required: true,
    },
    provider: {
      type: String,
      enum: ['CLOUDINARY'],
      default: 'CLOUDINARY',
      immutable: true,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    resourceType: {
      type: String,
      default: 'image',
    },
    deliveryType: {
      type: String,
      default: 'authenticated',
    },
    format: String,
    mimeType: String,
    bytes: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

uploadAssetSchema.index({ ownerUserId: 1, purpose: 1, createdAt: -1 });

export const UploadAsset = mongoose.model('UploadAsset', uploadAssetSchema);
