import mongoose from 'mongoose';
import { MATCHING_PARTNER_MODE } from '../constants/matching.constants.js';
import { OFFER_STATUS } from '../constants/offer.constants.js';
import {
  PARTNER_AVAILABILITY_STATUS,
  PARTNER_OPERATION_LIMITS,
  PARTNER_VERIFICATION_STATUS,
  TRIP_STATUS,
} from '../constants/partner.constants.js';
import { Offer } from '../models/offer.model.js';
import { Partner } from '../models/partner.model.js';
import { Trip } from '../models/trip.model.js';
import { AppError } from '../utils/app-error.js';
import { dispatchNextOfferBatch } from './offer.service.js';

function toOperationalPartner(partner) {
  const coordinates = partner.currentLocation?.coordinates;

  return {
    id: partner._id.toString(),
    verificationStatus: partner.verificationStatus,
    availabilityStatus: partner.availabilityStatus,
    ratingAverage: Number(partner.ratingAverage ?? 0),
    ratingCount: Number(partner.ratingCount ?? 0),
    currentLocation: coordinates
      ? {
          longitude: coordinates[0],
          latitude: coordinates[1],
          accuracyMeters: partner.locationAccuracyMeters ?? null,
          updatedAt: partner.locationUpdatedAt,
        }
      : null,
    activeOrderId: partner.activeOrderId?.toString?.() ?? null,
  };
}

async function getApprovedPartner(partnerId) {
  const partner = await Partner.findById(partnerId);

  if (!partner || partner.verificationStatus !== PARTNER_VERIFICATION_STATUS.APPROVED) {
    throw new AppError('Approved partner access required.', {
      statusCode: 403,
      code: 'APPROVED_PARTNER_REQUIRED',
    });
  }

  return partner;
}

function locationIsFresh(partner) {
  if (!partner.currentLocation || !partner.locationUpdatedAt) return false;

  const ageMs = Date.now() - partner.locationUpdatedAt.getTime();
  return ageMs <= PARTNER_OPERATION_LIMITS.MAX_LOCATION_AGE_SECONDS * 1000;
}

export async function updatePartnerLocation({ partnerId, payload }) {
  const partner = await getApprovedPartner(partnerId);

  partner.currentLocation = {
    type: 'Point',
    // GeoJSON always stores longitude first.
    coordinates: [payload.longitude, payload.latitude],
  };
  partner.locationAccuracyMeters = payload.accuracyMeters ?? null;
  partner.locationUpdatedAt = new Date();
  await partner.save();

  return toOperationalPartner(partner);
}

async function goOfflineAndCancelNearbyOffers(partnerId) {
  const session = await mongoose.startSession();
  let updatedPartner = null;
  let attemptIds = [];
  const now = new Date();

  try {
    await session.withTransaction(async () => {
      const partner = await Partner.findOne({
        _id: partnerId,
        verificationStatus: PARTNER_VERIFICATION_STATUS.APPROVED,
        activeOrderId: null,
      }).session(session);

      if (!partner) {
        throw new AppError('Availability cannot be changed while you have an active order.', {
          statusCode: 409,
          code: 'PARTNER_HAS_ACTIVE_ORDER',
        });
      }

      partner.availabilityStatus = PARTNER_AVAILABILITY_STATUS.OFFLINE;
      await partner.save({ session });
      updatedPartner = partner;

      const pendingOffers = await Offer.find({
        partnerId: partner._id,
        partnerMode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
        status: OFFER_STATUS.PENDING,
      })
        .select('matchingAttemptId')
        .session(session);

      if (pendingOffers.length > 0) {
        await Offer.updateMany(
          {
            partnerId: partner._id,
            partnerMode: MATCHING_PARTNER_MODE.AVAILABLE_NOW,
            status: OFFER_STATUS.PENDING,
          },
          { $set: { status: OFFER_STATUS.CANCELLED, respondedAt: now } },
          { session },
        );
        attemptIds = [...new Set(pendingOffers.map((offer) => offer.matchingAttemptId.toString()))];
      }
    });
  } finally {
    await session.endSession();
  }

  for (const attemptId of attemptIds) {
    await dispatchNextOfferBatch(attemptId, now);
  }

  return toOperationalPartner(updatedPartner);
}

export async function updatePartnerAvailability({ partnerId, status }) {
  const partner = await getApprovedPartner(partnerId);

  if (partner.availabilityStatus === status) {
    return toOperationalPartner(partner);
  }

  if (partner.activeOrderId) {
    throw new AppError('Availability cannot be changed while you have an active order.', {
      statusCode: 409,
      code: 'PARTNER_HAS_ACTIVE_ORDER',
    });
  }

  if (status === PARTNER_AVAILABILITY_STATUS.OFFLINE) {
    return goOfflineAndCancelNearbyOffers(partner._id);
  }

  if (status === PARTNER_AVAILABILITY_STATUS.AVAILABLE_NOW) {
    if (!locationIsFresh(partner)) {
      throw new AppError('Update your current location before going available.', {
        statusCode: 422,
        code: 'FRESH_LOCATION_REQUIRED',
      });
    }

    const activeTripExists = await Trip.exists({
      partnerId: partner._id,
      status: TRIP_STATUS.ACTIVE,
    });

    if (activeTripExists) {
      throw new AppError('End your active trip before switching to Available Now.', {
        statusCode: 409,
        code: 'ACTIVE_TRIP_CONFLICT',
      });
    }
  }

  partner.availabilityStatus = status;
  await partner.save();

  return toOperationalPartner(partner);
}

export async function getPartnerOperationalState(partnerId) {
  const partner = await getApprovedPartner(partnerId);
  return toOperationalPartner(partner);
}
