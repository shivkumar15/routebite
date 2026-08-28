export const PARTNER_VERIFICATION_STATUS = Object.freeze({
  PENDING: 'PENDING_VERIFICATION',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const PARTNER_AVAILABILITY_STATUS = Object.freeze({
  OFFLINE: 'OFFLINE',
  AVAILABLE_NOW: 'AVAILABLE_NOW',
});

export const TRIP_STATUS = Object.freeze({
  SCHEDULED: 'TRIP_SCHEDULED',
  ACTIVE: 'TRIP_ACTIVE',
  COMPLETED: 'TRIP_COMPLETED',
  CANCELLED: 'TRIP_CANCELLED',
});

export const PARTNER_OPERATION_LIMITS = Object.freeze({
  // Browser tabs can throttle timers/geolocation in the background. Keep the
  // foreground heartbeat frequent, but allow a practical prototype grace window
  // before matching treats an AVAILABLE_NOW partner as stale.
  MAX_LOCATION_AGE_SECONDS: 300,
  DEFAULT_DEPARTURE_FLEX_MINUTES: 15,
  MAX_DEPARTURE_FLEX_MINUTES: 180,
});

export const UPLOAD_PURPOSE = Object.freeze({
  PROFILE_PHOTO: 'PROFILE_PHOTO',
  COLLEGE_ID: 'COLLEGE_ID',
  ORDER_RECEIPT: 'ORDER_RECEIPT',
});