import { DELIVERY_OPERATION_LIMITS } from '../constants/delivery.constants.js';
import { ORDER_STATUS } from '../constants/order.constants.js';
import { Order } from '../models/order.model.js';
import { Partner } from '../models/partner.model.js';
import { getSocketServer } from '../socket/index.js';
import { AppError } from '../utils/app-error.js';

const TRACKABLE_ORDER_STATUSES = new Set([
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERY_OTP_REQUIRED,
]);

function emitToCustomer(customerId, eventName, payload) {
  getSocketServer()?.to(`user:${customerId}`).emit(eventName, payload);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function locationPayload(partner, order, now = new Date()) {
  if (!partner?.currentLocation || !partner.locationUpdatedAt) return null;

  const latitude = partner.currentLocation.coordinates[1];
  const longitude = partner.currentLocation.coordinates[0];
  const ageMs = now.getTime() - new Date(partner.locationUpdatedAt).getTime();
  const stale = ageMs > DELIVERY_OPERATION_LIMITS.LIVE_LOCATION_STALE_SECONDS * 1000;

  return {
    latitude,
    longitude,
    accuracyMeters: partner.locationAccuracyMeters ?? null,
    updatedAt: partner.locationUpdatedAt,
    stale,
    distanceToDropMeters: distanceMeters(
      { latitude, longitude },
      {
        latitude: order.drop.coordinates[1],
        longitude: order.drop.coordinates[0],
      },
    ),
  };
}

async function getPartnerActiveDelivery(partnerId) {
  const partner = await Partner.findById(partnerId);
  if (!partner?.activeOrderId) {
    throw new AppError('You do not have an active delivery.', {
      statusCode: 409,
      code: 'ACTIVE_ORDER_REQUIRED',
    });
  }

  const order = await Order.findOne({
    _id: partner.activeOrderId,
    assignedPartnerId: partner._id,
  });

  if (!order) {
    throw new AppError('Active order reference is inconsistent.', {
      statusCode: 409,
      code: 'ACTIVE_ORDER_INCONSISTENT',
    });
  }

  return { partner, order };
}

export async function startDeliveryTracking({ partnerId }, now = new Date()) {
  const { order } = await getPartnerActiveDelivery(partnerId);

  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      assignedPartnerId: partnerId,
      status: ORDER_STATUS.PICKED_UP,
    },
    {
      $set: {
        status: ORDER_STATUS.OUT_FOR_DELIVERY,
        deliveryStartedAt: now,
      },
    },
    { returnDocument: 'after', runValidators: true },
  );

  if (!updated) {
    throw new AppError('Live delivery cannot start from the current order state.', {
      statusCode: 409,
      code: 'DELIVERY_START_CONFLICT',
    });
  }

  emitToCustomer(updated.customerId.toString(), 'order:delivery-started', {
    orderId: updated._id.toString(),
    status: updated.status,
    deliveryStartedAt: updated.deliveryStartedAt,
  });

  return updated;
}

export async function updateActiveDeliveryLocation({ partnerId, payload }, now = new Date()) {
  const { order } = await getPartnerActiveDelivery(partnerId);

  if (!TRACKABLE_ORDER_STATUSES.has(order.status)) {
    throw new AppError('Live location is accepted only during an active delivery.', {
      statusCode: 409,
      code: 'DELIVERY_TRACKING_NOT_ACTIVE',
    });
  }

  const partner = await Partner.findOneAndUpdate(
    { _id: partnerId, activeOrderId: order._id },
    {
      $set: {
        currentLocation: {
          type: 'Point',
          coordinates: [Number(payload.longitude), Number(payload.latitude)],
        },
        locationAccuracyMeters: payload.accuracyMeters ?? null,
        locationUpdatedAt: now,
      },
    },
    { returnDocument: 'after', runValidators: true },
  );

  if (!partner) {
    throw new AppError('The active delivery changed while location was updating.', {
      statusCode: 409,
      code: 'DELIVERY_LOCATION_CONFLICT',
    });
  }

  const location = locationPayload(partner, order, now);
  emitToCustomer(order.customerId.toString(), 'delivery:location', {
    orderId: order._id.toString(),
    status: order.status,
    location,
  });

  return {
    orderId: order._id.toString(),
    status: order.status,
    location,
  };
}

export async function getCustomerTracking({ customerId, orderId }, now = new Date()) {
  const order = await Order.findOne({ _id: orderId, customerId });
  if (!order) {
    throw new AppError('Order not found.', {
      statusCode: 404,
      code: 'ORDER_NOT_FOUND',
    });
  }

  const active = TRACKABLE_ORDER_STATUSES.has(order.status);
  if (!active || !order.assignedPartnerId) {
    return {
      orderId: order._id.toString(),
      status: order.status,
      active: false,
      trackingStartedAt: order.deliveryStartedAt ?? null,
      location: null,
    };
  }

  const partner = await Partner.findById(order.assignedPartnerId).select(
    'currentLocation locationAccuracyMeters locationUpdatedAt activeOrderId',
  );

  const stillAssigned = partner?.activeOrderId?.toString() === order._id.toString();

  return {
    orderId: order._id.toString(),
    status: order.status,
    active: Boolean(stillAssigned),
    trackingStartedAt: order.deliveryStartedAt ?? null,
    location: stillAssigned ? locationPayload(partner, order, now) : null,
  };
}

export { distanceMeters };
