import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LocationPicker from './LocationPicker.jsx';

function setGeolocation(geolocation) {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    configurable: true,
    value: geolocation,
  });
}

function configuredProvider() {
  const callbacks = {};
  const mapController = { setLocation: vi.fn(), destroy: vi.fn() };
  const autocompleteController = { destroy: vi.fn() };

  return {
    callbacks,
    mapController,
    provider: {
      isConfigured: () => true,
      createAutocomplete: vi.fn(async (options) => {
        callbacks.autocomplete = options;
        return autocompleteController;
      }),
      createMap: vi.fn(async (options) => {
        callbacks.map = options;
        return mapController;
      }),
      reverseGeocode: vi.fn(async () => 'IIIT Allahabad Main Gate'),
    },
  };
}

describe('LocationPicker', () => {
  afterEach(() => {
    setGeolocation(undefined);
  });

  it('keeps raw coordinates out of the normal unconfigured UI', () => {
    const provider = { isConfigured: () => false };

    render(
      <LocationPicker
        label="Pickup point"
        value={{ label: '', latitude: '', longitude: '' }}
        onChange={() => {}}
        provider={provider}
        allowDevelopmentFallback={false}
      />,
    );

    expect(screen.getByText('Map search is not configured in this environment.')).toBeVisible();
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Longitude')).not.toBeInTheDocument();
  });

  it('uses browser location without requiring a map key', async () => {
    const onChange = vi.fn();
    const provider = { isConfigured: () => false };
    setGeolocation({
      getCurrentPosition: vi.fn((success) => success({
        coords: { latitude: 26.54092, longitude: 85.54828, accuracy: 10 },
      })),
    });

    render(
      <LocationPicker
        label="Pickup point"
        value={{ label: '', latitude: '', longitude: '' }}
        onChange={onChange}
        provider={provider}
        allowDevelopmentFallback={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({
      label: 'My current location',
      latitude: 26.54092,
      longitude: 85.54828,
    }));
  });

  it('normalizes a provider place selection and moves the map pin', async () => {
    const onChange = vi.fn();
    const { callbacks, mapController, provider } = configuredProvider();

    render(
      <LocationPicker
        label="Deliver to"
        purpose="delivery destination"
        value={{ label: '', latitude: '', longitude: '' }}
        onChange={onChange}
        provider={provider}
        allowDevelopmentFallback={false}
      />,
    );

    await waitFor(() => expect(callbacks.autocomplete).toBeDefined());

    act(() => callbacks.autocomplete.onSelect({
      label: 'Campus Gate 2',
      latitude: 25.43,
      longitude: 81.77,
    }));

    expect(onChange).toHaveBeenCalledWith({
      label: 'Campus Gate 2',
      latitude: 25.43,
      longitude: 81.77,
    });
    expect(mapController.setLocation).toHaveBeenCalled();
  });

  it('reverse-geocodes a manually moved pin before updating the value', async () => {
    const onChange = vi.fn();
    const { callbacks, provider } = configuredProvider();

    render(
      <LocationPicker
        label="Pickup point"
        value={{ label: '', latitude: '', longitude: '' }}
        onChange={onChange}
        provider={provider}
        allowDevelopmentFallback={false}
      />,
    );

    await waitFor(() => expect(callbacks.map).toBeDefined());

    await act(async () => {
      callbacks.map.onPinChange({ latitude: 25.44, longitude: 81.78 });
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({
      label: 'IIIT Allahabad Main Gate',
      latitude: 25.44,
      longitude: 81.78,
    }));
  });

  it('shows a recoverable provider-load error', async () => {
    const provider = {
      isConfigured: () => true,
      createAutocomplete: vi.fn(async () => {
        throw new Error('Maps network request failed.');
      }),
      createMap: vi.fn(),
      reverseGeocode: vi.fn(),
    };

    render(
      <LocationPicker
        label="Pickup point"
        value={{ label: '', latitude: '', longitude: '' }}
        onChange={() => {}}
        provider={provider}
      />,
    );

    expect(await screen.findByText('Maps network request failed.')).toBeVisible();
    expect(screen.getByText('Map unavailable. Retry by reloading this page.')).toBeVisible();
  });
});
