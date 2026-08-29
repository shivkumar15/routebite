import { useEffect, useId, useRef, useState } from 'react';
import { getBrowserLocation } from '../../services/browser-location.service.js';
import { googleMapsProvider } from '../../services/google-maps-provider.js';
import { isCompleteLocation, normalizeLocation } from '../../utils/location.js';

const developmentFallbackEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_COORDINATE_FALLBACK === 'true';

export default function LocationPicker({
  label,
  description,
  purpose = 'location',
  value,
  onChange,
  disabled = false,
  required = true,
  provider = googleMapsProvider,
  allowDevelopmentFallback = developmentFallbackEnabled,
}) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const searchContainerRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapControllerRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const pinRequestRef = useRef(0);
  const [providerStatus, setProviderStatus] = useState(
    provider.isConfigured() ? 'loading' : 'unconfigured',
  );
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  valueRef.current = value;
  onChangeRef.current = onChange;
  disabledRef.current = disabled;

  function commitLocation(next, fallbackLabel = '') {
    const current = valueRef.current ?? {};
    const normalized = normalizeLocation(
      {
        ...current,
        ...next,
        label: next.label ?? current.label,
      },
      fallbackLabel,
    );

    if (!normalized) return;
    onChangeRef.current(normalized);
    mapControllerRef.current?.setLocation(normalized);
  }

  async function labelPin(location, fallbackLabel = 'Pinned location') {
    if (disabledRef.current) return;
    const requestId = ++pinRequestRef.current;
    setBusy('pin');
    setError('');
    setMessage('Pin selected. Finding a readable location name…');

    let resolvedLabel = '';
    try {
      resolvedLabel = await provider.reverseGeocode(location);
    } catch {
      if (requestId === pinRequestRef.current) {
        setMessage('Pin selected. Add a short location name before continuing.');
      }
    }

    if (requestId !== pinRequestRef.current) return;

    commitLocation(
      { ...location, label: resolvedLabel || valueRef.current?.label || fallbackLabel },
      fallbackLabel,
    );

    if (resolvedLabel) setMessage('Pin and location name updated.');
    setBusy('');
  }

  useEffect(() => {
    if (!provider.isConfigured()) {
      setProviderStatus('unconfigured');
      return undefined;
    }

    let cancelled = false;
    let autocompleteController = null;
    let mapController = null;
    setProviderStatus('loading');
    setError('');

    async function initializeProvider() {
      try {
        autocompleteController = await provider.createAutocomplete({
          container: searchContainerRef.current,
          placeholder: `Search ${purpose}`,
          onSelect: (location) => {
            if (cancelled || disabledRef.current) return;
            pinRequestRef.current += 1;
            setBusy('');
            commitLocation(location, 'Selected place');
            setMessage('Place selected. Move the pin if the exact point is different.');
            setError('');
          },
          onError: (providerError) => {
            if (!cancelled) setError(providerError.message || 'Place search failed. Try again.');
          },
        });

        if (cancelled) {
          autocompleteController.destroy();
          return;
        }

        mapController = await provider.createMap({
          container: mapContainerRef.current,
          value: valueRef.current,
          onPinChange: (location) => {
            if (!cancelled && !disabledRef.current) labelPin(location);
          },
        });

        if (cancelled) {
          autocompleteController.destroy();
          mapController.destroy();
          return;
        }

        mapControllerRef.current = mapController;
        setProviderStatus('ready');
      } catch (providerError) {
        autocompleteController?.destroy();
        mapController?.destroy();
        if (!cancelled) {
          setProviderStatus('error');
          setError(providerError.message || 'Map search could not be loaded.');
        }
      }
    }

    initializeProvider();

    return () => {
      cancelled = true;
      autocompleteController?.destroy();
      mapController?.destroy();
      mapControllerRef.current = null;
    };
  }, [provider, purpose]);

  useEffect(() => {
    if (providerStatus === 'ready') {
      mapControllerRef.current?.setLocation(value, { recenter: false });
    }
  }, [providerStatus, value?.latitude, value?.longitude]);

  async function useCurrentLocation() {
    setBusy('current');
    setError('');
    setMessage('Finding your current location…');

    try {
      const location = await getBrowserLocation();
      if (providerStatus === 'ready') {
        await labelPin(location, 'My current location');
      } else {
        commitLocation(
          { ...location, label: valueRef.current?.label || 'My current location' },
          'My current location',
        );
        setMessage('Current location selected. Add a clearer location name if needed.');
      }
    } catch (locationError) {
      setError(locationError.message);
      setMessage('');
    } finally {
      setBusy('');
    }
  }

  function updateField(field, fieldValue) {
    onChangeRef.current({ ...(valueRef.current ?? {}), [field]: fieldValue });
    setMessage('');
  }

  const complete = isCompleteLocation(value);

  return (
    <fieldset className={`location-picker ${complete ? 'has-selection' : ''}`} disabled={disabled}>
      <legend id={labelId}>{label}</legend>
      {description ? <p className="location-picker-description">{description}</p> : null}

      <div className="location-picker-toolbar">
        <button
          className="secondary-button compact-button"
          type="button"
          disabled={disabled || Boolean(busy)}
          onClick={useCurrentLocation}
        >
          {busy === 'current' ? 'Locating…' : 'Use my current location'}
        </button>
        {complete ? <span className="location-selection-status">Location selected</span> : null}
      </div>

      {providerStatus !== 'unconfigured' ? (
        <div className="location-search-block">
          <span className="location-control-label">Search by place, address or landmark</span>
          <div
            ref={searchContainerRef}
            className="location-search-container"
            aria-labelledby={labelId}
          />
        </div>
      ) : null}

      <label className="location-label-input">
        Location name
        <input
          value={value?.label ?? ''}
          onChange={(event) => updateField('label', event.target.value)}
          placeholder={purpose === 'pickup' ? 'Food place or nearby landmark' : 'Delivery place or landmark'}
          required={required}
          disabled={disabled}
        />
        <small>Keep this understandable for the other person—for example, a gate, shop or landmark.</small>
      </label>

      {provider.isConfigured() ? (
        <div className="location-map-frame">
          <div ref={mapContainerRef} className="location-map" aria-label={`${label} map`} />
          {providerStatus === 'loading' ? <div className="location-map-overlay">Loading map…</div> : null}
          {providerStatus === 'error' ? (
            <div className="location-map-overlay is-error">Map unavailable. Retry by reloading this page.</div>
          ) : null}
        </div>
      ) : (
        <div className="location-provider-notice" role="status">
          <strong>Map search is not configured in this environment.</strong>
          <span>Current location still works. Development coordinates are available below until the browser key is added.</span>
        </div>
      )}

      {allowDevelopmentFallback ? (
        <details className="location-development-controls">
          <summary>Development location controls</summary>
          <p>Use only while map search is being configured or tested.</p>
          <div className="coordinate-grid">
            <label>
              Latitude
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={value?.latitude ?? ''}
                onChange={(event) => updateField('latitude', event.target.value)}
                required={required}
                disabled={disabled}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={value?.longitude ?? ''}
                onChange={(event) => updateField('longitude', event.target.value)}
                required={required}
                disabled={disabled}
              />
            </label>
          </div>
        </details>
      ) : null}

      <div className="location-picker-feedback" aria-live="polite">
        {busy === 'pin' ? <span>Updating the selected pin…</span> : message ? <span>{message}</span> : null}
        {error ? <span className="location-picker-error">{error}</span> : null}
      </div>
    </fieldset>
  );
}
