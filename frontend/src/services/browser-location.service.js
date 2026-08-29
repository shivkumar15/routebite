export class BrowserLocationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BrowserLocationError';
    this.code = code;
  }
}

function geolocationError(error) {
  if (error?.code === 1) {
    return new BrowserLocationError(
      'Location permission is blocked. Allow location access or search and place the pin manually.',
      'PERMISSION_DENIED',
    );
  }

  if (error?.code === 3) {
    return new BrowserLocationError(
      'Finding your location took too long. Try again or choose the place manually.',
      'TIMEOUT',
    );
  }

  return new BrowserLocationError(
    'Your current location is unavailable. Try again or choose the place manually.',
    'POSITION_UNAVAILABLE',
  );
}

export function getBrowserLocation({ maximumAge = 30000, timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) {
      reject(new BrowserLocationError(
        'This browser does not support location access. Search and place the pin manually.',
        'NOT_SUPPORTED',
      ));
      return;
    }

    globalThis.navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      }),
      (error) => reject(geolocationError(error)),
      {
        enableHighAccuracy: true,
        timeout,
        maximumAge,
      },
    );
  });
}
