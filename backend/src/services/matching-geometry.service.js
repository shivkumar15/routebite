const EARTH_RADIUS_METERS = 6371000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a, b) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function localXY(point, origin) {
  const lat0 = toRadians(origin.latitude);
  return {
    x: toRadians(point.longitude - origin.longitude) * EARTH_RADIUS_METERS * Math.cos(lat0),
    y: toRadians(point.latitude - origin.latitude) * EARTH_RADIUS_METERS,
  };
}

export function projectPointOnSegment(point, origin, destination) {
  const p = localXY(point, origin);
  const d = localXY(destination, origin);
  const lengthSquared = d.x ** 2 + d.y ** 2;

  if (lengthSquared === 0) {
    return { progress: 0, distanceMeters: haversineMeters(point, origin) };
  }

  const rawProgress = (p.x * d.x + p.y * d.y) / lengthSquared;
  const clampedProgress = Math.max(0, Math.min(1, rawProgress));
  const nearest = {
    x: d.x * clampedProgress,
    y: d.y * clampedProgress,
  };
  const distanceMeters = Math.hypot(p.x - nearest.x, p.y - nearest.y);

  return {
    progress: rawProgress,
    clampedProgress,
    distanceMeters,
  };
}

export function geoPointToLatLng(geoPoint) {
  return {
    longitude: geoPoint.coordinates[0],
    latitude: geoPoint.coordinates[1],
  };
}
