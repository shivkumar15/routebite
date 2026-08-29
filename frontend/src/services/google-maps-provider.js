import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { normalizeLocation, readLatLng } from '../utils/location.js';

const browserKey = String(import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY ?? '').trim();
const mapId = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '').trim() || 'DEMO_MAP_ID';

let loaderConfigured = false;
let locationLibrariesPromise = null;
let geocoderPromise = null;

export class MapsProviderError extends Error {
  constructor(message, code = 'MAPS_PROVIDER_ERROR') {
    super(message);
    this.name = 'MapsProviderError';
    this.code = code;
  }
}

function configureLoader() {
  if (!browserKey) {
    throw new MapsProviderError(
      'Google Maps is not configured for this environment.',
      'MAPS_NOT_CONFIGURED',
    );
  }

  if (loaderConfigured) return;

  setOptions({
    key: browserKey,
    v: 'quarterly',
    language: 'en',
    region: 'IN',
    authReferrerPolicy: 'origin',
  });
  loaderConfigured = true;
}

async function loadLocationLibraries() {
  configureLoader();

  if (!locationLibrariesPromise) {
    locationLibrariesPromise = Promise.all([
      importLibrary('maps'),
      importLibrary('places'),
      importLibrary('marker'),
    ])
      .then(([maps, places, marker]) => ({ maps, places, marker }))
      .catch((error) => {
        locationLibrariesPromise = null;
        throw new MapsProviderError(
          error?.message || 'Google Maps could not be loaded.',
          'MAPS_LOAD_FAILED',
        );
      });
  }

  return locationLibrariesPromise;
}

function placeLabel(place) {
  const name = String(place.displayName ?? '').trim();
  const address = String(place.formattedAddress ?? '').trim();

  if (name && address && !address.toLocaleLowerCase().includes(name.toLocaleLowerCase())) {
    return `${name}, ${address}`;
  }

  return address || name || 'Selected place';
}

async function selectedPlace(event) {
  const prediction = event?.placePrediction ?? event?.detail?.placePrediction;
  if (!prediction?.toPlace) {
    throw new MapsProviderError('Choose one of the suggested places.', 'PLACE_SELECTION_INVALID');
  }

  const place = prediction.toPlace();
  await place.fetchFields({
    fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport'],
  });

  const coordinates = readLatLng(place.location);
  if (!coordinates) {
    throw new MapsProviderError(
      'That result does not contain a usable map location.',
      'PLACE_LOCATION_MISSING',
    );
  }

  return {
    ...coordinates,
    label: placeLabel(place),
    providerPlaceId: place.id ?? null,
    viewport: place.viewport ?? null,
  };
}

export const googleMapsProvider = {
  isConfigured() {
    return Boolean(browserKey);
  },

  async createAutocomplete({ container, placeholder, onSelect, onError }) {
    if (!container) {
      throw new MapsProviderError('Place search container is unavailable.', 'MAP_CONTAINER_MISSING');
    }

    const { places } = await loadLocationLibraries();
    const element = new places.PlaceAutocompleteElement();
    element.className = 'location-search-element';
    element.placeholder = placeholder;
    element.setAttribute('aria-label', placeholder);

    async function handleSelection(event) {
      try {
        onSelect(await selectedPlace(event));
      } catch (error) {
        onError(error);
      }
    }

    element.addEventListener('gmp-select', handleSelection);
    container.replaceChildren(element);

    return {
      destroy() {
        element.removeEventListener('gmp-select', handleSelection);
        if (element.parentNode === container) container.replaceChildren();
      },
    };
  },

  async createMap({ container, value, onPinChange }) {
    if (!container) {
      throw new MapsProviderError('Map container is unavailable.', 'MAP_CONTAINER_MISSING');
    }

    const { maps, marker } = await loadLocationLibraries();
    const initial = normalizeLocation(value);
    const map = new maps.Map(container, {
      center: initial
        ? { lat: initial.latitude, lng: initial.longitude }
        : { lat: 22.9734, lng: 78.6569 },
      zoom: initial ? 16 : 5,
      mapId,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      clickableIcons: false,
      gestureHandling: 'cooperative',
    });

    let pin = null;
    let dragListener = null;

    function ensurePin(location) {
      const position = { lat: location.latitude, lng: location.longitude };

      if (!pin) {
        pin = new marker.AdvancedMarkerElement({
          map,
          position,
          gmpDraggable: true,
          title: 'Selected location. Drag to adjust the pin.',
        });
        dragListener = pin.addListener('dragend', () => {
          const next = readLatLng(pin.position);
          if (next) onPinChange(next);
        });
      } else {
        pin.position = position;
      }
    }

    if (initial) ensurePin(initial);

    const clickListener = map.addListener('click', (event) => {
      const next = readLatLng(event.latLng);
      if (!next) return;
      ensurePin(next);
      onPinChange(next);
    });

    return {
      setLocation(location, { recenter = true } = {}) {
        const next = normalizeLocation(location);
        if (!next) return;
        ensurePin(next);
        if (recenter) {
          map.panTo({ lat: next.latitude, lng: next.longitude });
          if (map.getZoom() < 15) map.setZoom(16);
        }
      },
      destroy() {
        clickListener.remove();
        dragListener?.remove();
        if (pin) pin.map = null;
        container.replaceChildren();
      },
    };
  },

  async reverseGeocode(location) {
    const normalized = normalizeLocation(location);
    if (!normalized) return '';

    configureLoader();
    if (!geocoderPromise) {
      geocoderPromise = importLibrary('geocoding')
        .then(({ Geocoder }) => new Geocoder())
        .catch((error) => {
          geocoderPromise = null;
          throw error;
        });
    }

    const geocoder = await geocoderPromise;
    const response = await geocoder.geocode({
      location: { lat: normalized.latitude, lng: normalized.longitude },
      region: 'IN',
    });

    return response.results?.[0]?.formatted_address ?? '';
  },
};
