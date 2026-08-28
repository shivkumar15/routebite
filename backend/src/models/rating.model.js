import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator(value) {
          return Number.isInteger(value);
        },
        message: 'Rating score must be an integer from 1 to 5.',
      },
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ratingSchema.index({ partnerId: 1, createdAt: -1 });
ratingSchema.index({ customerId: 1, createdAt: -1 });

export const Rating = mongoose.model('Rating', ratingSchema);
