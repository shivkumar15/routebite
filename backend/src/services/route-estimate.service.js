import axios from 'axios';
import { env } from '../config/env.js';
import { MATCHING_LIMITS } from '../constants/matching.constants.js';
import { AppError } from '../utils/app-error.js';
import { haversineMeters } from './matching-geometry.service.js';

function googleWaypoint(point) {
  return {
    location: {
      latLng: {
        latitude: point.latitude,
        longitude: point.longitude,
      },
    },
  };
}

function parseGoogleDurationSeconds(value) {
  if (typeof value !== 'string' || !value.endsWith('s')) return null;
  const seconds = Number(value.slice(0, -1));
  return Number.isFinite(seconds) ? seconds : null;
}

function approximateRoute(points) {
  let directMeters = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    directMeters += haversineMeters(points[index], points[index + 1]);
  }

  const distanceMeters = Math.round(directMeters * MATCHING_LIMITS.DEV_ROAD_DISTANCE_FACTOR);
  const metersPerSecond = (MATCHING_LIMITS.DEV_APPROXIMATE_SPEED_KPH * 1000) / 3600;
  const durationSeconds = Math.max(60, Math.round(distanceMeters / metersPerSecond));

  return {
    distanceMeters,
    durationSeconds,
    source: 'DEV_APPROXIMATION',
  };
}

export async function estimateRoute(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new AppError('At least two route points are required.', {
      statusCode: 500,
      code: 'INVALID_ROUTE_REQUEST',
    });
  }

  if (!env.googleMaps.apiKey) {
    if (env.nodeEnv === 'production') {
      throw new AppError('Google Maps routing is not configured.', {
        statusCode: 503,
        code: 'ROUTING_PROVIDER_NOT_CONFIGURED',
      });
    }
    return approximateRoute(points);
  }

  const [origin, ...rest] = points;
  const destination = rest.at(-1);
  const intermediates = rest.slice(0, -1);

  try {
    const { data } = await axios.post(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        origin: googleWaypoint(origin),
        destination: googleWaypoint(destination),
        intermediates: intermediates.map(googleWaypoint),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        languageCode: 'en-IN',
        units: 'METRIC',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': env.googleMaps.apiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
        },
        timeout: 8000,
      },
    );

    const route = data?.routes?.[0];
    const durationSeconds = parseGoogleDurationSeconds(route?.duration);
    const distanceMeters = Number(route?.distanceMeters);

    if (!Number.isFinite(durationSeconds) || !Number.isFinite(distanceMeters)) {
      throw new Error('Google Routes returned no usable route.');
    }

    return {
      durationSeconds: Math.round(durationSeconds),
      distanceMeters: Math.round(distanceMeters),
      source: 'GOOGLE_ROUTES',
    };
  } catch (error) {
    if (env.nodeEnv !== 'production') {
      return approximateRoute(points);
    }

    throw new AppError('Could not calculate a road route for this candidate.', {
      statusCode: 503,
      code: 'ROUTING_PROVIDER_ERROR',
      details: { providerMessage: error.response?.data?.error?.message ?? error.message },
    });
  }
}
