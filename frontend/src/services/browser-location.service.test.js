import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBrowserLocation } from './browser-location.service.js';

function setGeolocation(geolocation) {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: geolocation,
  });
}

describe('browser location service', () => {
  afterEach(() => {
    setGeolocation(undefined);
  });

  it('returns coordinates and accuracy from the browser', async () => {
    setGeolocation({
      getCurrentPosition: vi.fn((success) => success({
        coords: { latitude: 25.43, longitude: 81.77, accuracy: 12 },
      })),
    });

    await expect(getBrowserLocation()).resolves.toEqual({
      latitude: 25.43,
      longitude: 81.77,
      accuracyMeters: 12,
    });
  });

  it('returns an actionable permission-denied error', async () => {
    setGeolocation({
      getCurrentPosition: vi.fn((_success, failure) => failure({ code: 1 })),
    });

    await expect(getBrowserLocation()).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
      message: expect.stringContaining('Allow location access'),
    });
  });

  it('returns an actionable timeout error', async () => {
    setGeolocation({
      getCurrentPosition: vi.fn((_success, failure) => failure({ code: 3 })),
    });

    await expect(getBrowserLocation()).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: expect.stringContaining('took too long'),
    });
  });
});
