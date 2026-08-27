import mongoose from 'mongoose';
import {
  PARTNER_AVAILABILITY_STATUS,
  PARTNER_VERIFICATION_STATUS,
  TRIP_STATUS,
} from '../constants/partner.constants.js';
import { Partner } from '../models/partner.model.js';
import { Trip } from '../models/trip.model.js';
import { AppError } from '../utils/app-error.js';

function toSafeTrip(trip) {
  return {
    id: trip._id.toString(),
    status: trip.status,
    origin: {
      longitude: trip.origin.coordinates[0],
      latitude: trip.origin.coordinates[1],
      label: trip.originText,
    },
    destination: {
      longitude: trip.destination.coordinates[0],
      latitude: trip.destination.coordinates[1],
      label: trip.destinationText,
    },
    scheduledDepartureAt: trip.scheduledDepartureAt,
    departureFlexMinutes: trip.departureFlexMinutes,
    routeDistanceMeters: trip.routeDistanceMeters ?? null,
    routeDurationSeconds: trip.routeDurationSeconds ?? null,
    startedAt: trip.startedAt ?? null,
    completedAt: trip.completedAt ?? null,
    cancelledAt: trip.cancelledAt ?? null,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

async function getApprovedPartner(partnerId, session = null) {
  let query = Partner.findById(partnerId);
  if (session) query = query.session(session);

  const partner = await query;

  if (!partner || partner.verificationStatus !== PARTNER_VERIFICATION_STATUS.APPROVED) {
    throw new AppError('Approved partner access required.', {
      statusCode: 403,
      code: 'APPROVED_PARTNER_REQUIRED',
    });
  }

  return partner;
}

function pointFromInput(point) {
  return {
    type: 'Point',
    // GeoJSON coordinate order is [longitude, latitude].
    coordinates: [point.longitude, point.latitude],
  };
}

function assertDifferentEndpoints(origin, destination) {
  if (
    origin.latitude === destination.latitude &&
    origin.longitude === destination.longitude
  ) {
    throw new AppError('Trip origin and destination must be different.', {
      statusCode: 422,
      code: 'TRIP_ENDPOINTS_SAME',
    });
  }
}

async function findOwnedTrip({ partnerId, tripId, session = null }) {
  let query = Trip.findOne({ _id: tripId, partnerId });
  if (session) query = query.session(session);

  const trip = await query;

  if (!trip) {
    throw new AppError('Trip not found.', {
      statusCode: 404,
      code: 'TRIP_NOT_FOUND',
    });
  }

  return trip;
}

export async function createTrip({ partnerId, payload }) {
  await getApprovedPartner(partnerId);

  const scheduledDepartureAt = new Date(payload.scheduledDepartureAt);

  if (scheduledDepartureAt.getTime() <= Date.now()) {
    throw new AppError('Scheduled departure must be in the future.', {
      statusCode: 422,
      code: 'TRIP_DEPARTURE_NOT_FUTURE',
    });
  }

  assertDifferentEndpoints(payload.origin, payload.destination);

  const trip = await Trip.create({
    partnerId,
    status: TRIP_STATUS.SCHEDULED,
    origin: pointFromInput(payload.origin),
    destination: pointFromInput(payload.destination),
    originText: payload.origin.label.trim(),
    destinationText: payload.destination.label.trim(),
    scheduledDepartureAt,
    departureFlexMinutes: payload.departureFlexMinutes,
  });

  return toSafeTrip(trip);
}

export async function listTrips(partnerId) {
  await getApprovedPartner(partnerId);

  const trips = await Trip.find({ partnerId }).sort({
    scheduledDepartureAt: -1,
    createdAt: -1,
  });

  return trips.map(toSafeTrip);
}

export async function getTrip({ partnerId, tripId }) {
  await getApprovedPartner(partnerId);
  const trip = await findOwnedTrip({ partnerId, tripId });
  return toSafeTrip(trip);
}

export async function startTrip({ partnerId, tripId }) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const partner = await getApprovedPartner(partnerId, session);

      if (partner.activeOrderId) {
        throw new AppError('You cannot start a trip while handling an active order.', {
          statusCode: 409,
          code: 'PARTNER_HAS_ACTIVE_ORDER',
        });
      }

      const trip = await findOwnedTrip({ partnerId, tripId, session });

      if (trip.status !== TRIP_STATUS.SCHEDULED) {
        throw new AppError('Only a scheduled trip can be started.', {
          statusCode: 409,
          code: 'TRIP_NOT_STARTABLE',
        });
      }

      const earliestStart =
        trip.scheduledDepartureAt.getTime() - trip.departureFlexMinutes * 60 * 1000;

      if (Date.now() < earliestStart) {
        throw new AppError('This trip is still too early to start.', {
          statusCode: 422,
          code: 'TRIP_TOO_EARLY',
        });
      }

      const activeTrip = await Trip.findOne({
        partnerId,
        status: TRIP_STATUS.ACTIVE,
      }).session(session);

      if (activeTrip) {
        throw new AppError('Finish or cancel your active trip before starting another.', {
          statusCode: 409,
          code: 'ACTIVE_TRIP_EXISTS',
        });
      }

      trip.status = TRIP_STATUS.ACTIVE;
      trip.startedAt = new Date();
      await trip.save({ session });

      partner.availabilityStatus = PARTNER_AVAILABILITY_STATUS.OFFLINE;
      await partner.save({ session });

      result = toSafeTrip(trip);
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Only one trip can be active at a time.', {
        statusCode: 409,
        code: 'ACTIVE_TRIP_EXISTS',
      });
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return result;
}

export async function cancelTrip({ partnerId, tripId }) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const partner = await getApprovedPartner(partnerId, session);
      const trip = await findOwnedTrip({ partnerId, tripId, session });

      if (![TRIP_STATUS.SCHEDULED, TRIP_STATUS.ACTIVE].includes(trip.status)) {
        throw new AppError('This trip can no longer be cancelled.', {
          statusCode: 409,
          code: 'TRIP_NOT_CANCELLABLE',
        });
      }

      if (trip.status === TRIP_STATUS.ACTIVE && partner.activeOrderId) {
        throw new AppError('An active trip cannot be cancelled while handling an order.', {
          statusCode: 409,
          code: 'PARTNER_HAS_ACTIVE_ORDER',
        });
      }

      trip.status = TRIP_STATUS.CANCELLED;
      trip.cancelledAt = new Date();
      await trip.save({ session });

      if (partner.availabilityStatus !== PARTNER_AVAILABILITY_STATUS.OFFLINE) {
        partner.availabilityStatus = PARTNER_AVAILABILITY_STATUS.OFFLINE;
        await partner.save({ session });
      }

      result = toSafeTrip(trip);
    });
  } finally {
    await session.endSession();
  }

  return result;
}

export async function completeTrip({ partnerId, tripId }) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const partner = await getApprovedPartner(partnerId, session);
      const trip = await findOwnedTrip({ partnerId, tripId, session });

      if (trip.status !== TRIP_STATUS.ACTIVE) {
        throw new AppError('Only an active trip can be completed.', {
          statusCode: 409,
          code: 'TRIP_NOT_COMPLETABLE',
        });
      }

      if (partner.activeOrderId) {
        throw new AppError('Complete the active delivery before ending this trip.', {
          statusCode: 409,
          code: 'PARTNER_HAS_ACTIVE_ORDER',
        });
      }

      trip.status = TRIP_STATUS.COMPLETED;
      trip.completedAt = new Date();
      await trip.save({ session });

      partner.availabilityStatus = PARTNER_AVAILABILITY_STATUS.OFFLINE;
      await partner.save({ session });

      result = toSafeTrip(trip);
    });
  } finally {
    await session.endSession();
  }

  return result;
}
