export const EMPTY_LOCATION = Object.freeze({
  label: '',
  latitude: '',
  longitude: '',
});

export function toFiniteCoordinate(value) {
  if (value === '' || value === null || value === undefined) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

export function isValidLatitude(value) {
  const latitude = toFiniteCoordinate(value);
  return latitude !== null && latitude >= -90 && latitude <= 90;
}

export function isValidLongitude(value) {
  const longitude = toFiniteCoordinate(value);
  return longitude !== null && longitude >= -180 && longitude <= 180;
}

export function isCompleteLocation(location) {
  return Boolean(
    location?.label?.trim() &&
      isValidLatitude(location.latitude) &&
      isValidLongitude(location.longitude),
  );
}

export function normalizeLocation(location, fallbackLabel = '') {
  const latitude = toFiniteCoordinate(location?.latitude);
  const longitude = toFiniteCoordinate(location?.longitude);

  if (
    latitude === null ||
    longitude === null ||
    !isValidLatitude(latitude) ||
    !isValidLongitude(longitude)
  ) {
    return null;
  }

  return {
    label: String(location?.label || fallbackLabel).trim(),
    latitude,
    longitude,
  };
}

export function locationToApiPayload(location) {
  const normalized = normalizeLocation(location);
  if (!normalized || !normalized.label) return null;
  return normalized;
}

export function readLatLng(position) {
  if (!position) return null;

  const latitude = typeof position.lat === 'function' ? position.lat() : position.lat;
  const longitude = typeof position.lng === 'function' ? position.lng() : position.lng;

  return normalizeLocation({ latitude, longitude }, 'Pinned location');
}
