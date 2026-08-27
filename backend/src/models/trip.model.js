import mongoose from 'mongoose';
import {
  PARTNER_OPERATION_LIMITS,
  TRIP_STATUS,
} from '../constants/partner.constants.js';

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

const tripSchema = new mongoose.Schema(
  {
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Partner',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TRIP_STATUS),
      default: TRIP_STATUS.SCHEDULED,
      index: true,
    },
    origin: {
      type: geoPointSchema,
      required: true,
    },
    destination: {
      type: geoPointSchema,
      required: true,
    },
    originText: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    destinationText: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    scheduledDepartureAt: {
      type: Date,
      required: true,
      index: true,
    },
    departureFlexMinutes: {
      type: Number,
      default: PARTNER_OPERATION_LIMITS.DEFAULT_DEPARTURE_FLEX_MINUTES,
      min: 0,
      max: PARTNER_OPERATION_LIMITS.MAX_DEPARTURE_FLEX_MINUTES,
    },
    routePolyline: {
      type: String,
      default: null,
      maxlength: 20000,
    },
    routeDistanceMeters: {
      type: Number,
      default: null,
      min: 0,
    },
    routeDurationSeconds: {
      type: Number,
      default: null,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    currentProgressMeters: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

tripSchema.index({ partnerId: 1, status: 1, scheduledDepartureAt: 1 });
tripSchema.index({ status: 1, scheduledDepartureAt: 1 });
tripSchema.index({ origin: '2dsphere' });
tripSchema.index({ destination: '2dsphere' });
tripSchema.index(
  { partnerId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: TRIP_STATUS.ACTIVE },
  },
);

export const Trip = mongoose.model('Trip', tripSchema);
