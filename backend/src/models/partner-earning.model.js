import mongoose from 'mongoose';

const partnerEarningSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true,
    },
    baseEarningPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    incentivePaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    totalEarningPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
    earnedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

partnerEarningSchema.index({ partnerId: 1, earnedAt: -1 });

export const PartnerEarning = mongoose.model('PartnerEarning', partnerEarningSchema);
