import { describe, expect, it } from 'vitest';
import {
  isCompleteLocation,
  isValidLatitude,
  isValidLongitude,
  locationToApiPayload,
  normalizeLocation,
  readLatLng,
} from './location.js';

describe('location utilities', () => {
  it('normalizes a complete location without changing coordinate meaning', () => {
    expect(normalizeLocation({
      label: '  Campus Gate 2  ',
      latitude: '25.430100',
      longitude: '81.770200',
    })).toEqual({
      label: 'Campus Gate 2',
      latitude: 25.4301,
      longitude: 81.7702,
    });
  });

  it('rejects missing, non-finite and out-of-range coordinates', () => {
    expect(isValidLatitude('')).toBe(false);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
    expect(normalizeLocation({ label: 'Bad', latitude: 'NaN', longitude: 81 })).toBeNull();
  });

  it('requires a readable label for a complete API location', () => {
    expect(isCompleteLocation({ label: '  ', latitude: 25, longitude: 81 })).toBe(false);
    expect(locationToApiPayload({ label: 'Gate', latitude: 25, longitude: 81 })).toEqual({
      label: 'Gate',
      latitude: 25,
      longitude: 81,
    });
  });

  it('reads Google LatLng methods without reversing latitude and longitude', () => {
    expect(readLatLng({ lat: () => 26.54092, lng: () => 85.54828 })).toEqual({
      label: 'Pinned location',
      latitude: 26.54092,
      longitude: 85.54828,
    });
  });
});
