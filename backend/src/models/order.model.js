import mongoose from 'mongoose';
import { PRICE_ADJUSTMENT_STATUS } from '../constants/delivery.constants.js';
import { DELIVERY_TYPE, ORDER_STATUS } from '../constants/order.constants.js';

const pointSchema = new mongoose.Schema(
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
        message: 'Location coordinates must be [longitude, latitude].',
      },
    },
  },
  { _id: false },
);

function moneyField({ required = true, defaultValue } = {}) {
  const field = {
    type: Number,
    required,
    min: 0,
    validate: {
      validator(value) {
        return value == null || Number.isSafeInteger(value);
      },
      message: 'Money values must be integer paise.',
    },
  };

  if (defaultValue !== undefined) field.default = defaultValue;
  return field;
}

const pricingSchema = new mongoose.Schema(
  {
    estimatedFoodCostPaise: moneyField(),
    customerDeliveryChargePaise: moneyField({ defaultValue: 0 }),
    partnerBaseEarningPaise: moneyField({ defaultValue: 0 }),
    platformFeePaise: moneyField({ defaultValue: 0 }),
    estimatedCustomerTotalPaise: moneyField({ defaultValue: 0 }),
    finalCustomerTotalPaise: moneyField({ required: false }),
  },
  { _id: false },
);

const priceAdjustmentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(PRICE_ADJUSTMENT_STATUS),
      default: PRICE_ADJUSTMENT_STATUS.NONE,
      required: true,
    },
    actualFoodCostPaise: moneyField({ required: false }),
    differencePaise: {
      type: Number,
      default: null,
      validate: {
        validator(value) {
          return value == null || Number.isSafeInteger(value);
        },
        message: 'Price difference must be integer paise.',
      },
    },
    receiptAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadAsset',
      default: null,
    },
    reportedAt: { type: Date, default: null },
    approvalExpiresAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.DRAFT,
      required: true,
      index: true,
    },
    vendorDisplayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    requestedItems: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 2000,
    },
    pickupInstructions: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    pickup: {
      type: pointSchema,
      required: true,
    },
    pickupText: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    drop: {
      type: pointSchema,
      required: true,
    },
    dropText: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    deliveryType: {
      type: String,
      enum: Object.values(DELIVERY_TYPE),
      required: true,
    },
    deliveryWindowStart: {
      type: Date,
      required: true,
    },
    deliveryWindowEnd: {
      type: Date,
      required: true,
    },
    assignedPartnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      default: null,
    },
    assignedTripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
    },
    pricing: {
      type: pricingSchema,
      required: true,
    },
    priceAdjustment: {
      type: priceAdjustmentSchema,
      default: () => ({}),
      required: true,
    },
    pickupStartedAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ pickup: '2dsphere' });
orderSchema.index({ drop: '2dsphere' });
orderSchema.index({ status: 1, deliveryWindowStart: 1 });
orderSchema.index({ status: 1, 'priceAdjustment.approvalExpiresAt': 1 });

export const Order = mongoose.model('Order', orderSchema);