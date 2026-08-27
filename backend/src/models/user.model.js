import mongoose from 'mongoose';
import { USER_ROLES } from '../constants/auth.constants.js';

const phoneVerificationSchema = new mongoose.Schema(
  {
    otpHash: { type: String, default: null, select: false },
    expiresAt: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
      immutable: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
    phoneVerification: {
      type: phoneVerificationSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
