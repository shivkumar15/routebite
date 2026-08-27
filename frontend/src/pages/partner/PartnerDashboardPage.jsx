import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';

const EMPTY_TRIP_FORM = {
  originLabel: '',
  originLatitude: '',
  originLongitude: '',
  destinationLabel: '',
  destinationLatitude: '',
  destinationLongitude: '',
  scheduledDepartureAt: '',
  departureFlexMinutes: '15',
};

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      (error) => reject(new Error(error.message || 'Could not access your location.')),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 15000,
      },
    );
  });
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status) {
  return status?.replaceAll('_', ' ') ?? '';
}

export default function PartnerDashboardPage() {
  const { refreshSession } = useAuth();
  const [operational, setOperational] = useState(null);
  const [trips, setTrips] = useState([]);
  const [tripForm, setTripForm] = useState(EMPTY_TRIP_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeTrip = useMemo(
    () => trips.find((trip) => trip.status === 'TRIP_ACTIVE') ?? null,
    [trips],
  );

  async function loadDashboard() {
    setError('');
    try {
      const [operationalResponse, tripsResponse] = await Promise.all([
        api.get('/partner/operational-state'),
        api.get('/partner/trips'),
      ]);
      setOperational(operationalResponse.data.data.partner);
      setTrips(tripsResponse.data.data.trips);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not load your partner workspace.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function saveCurrentLocation({ quiet = false } = {}) {
    const location = await getBrowserLocation();
    const { data } = await api.put('/partner/location', location);
    setOperational(data.data.partner);
    if (!quiet) setMessage('Current location updated.');
    return data.data.partner;
  }

  async function handleLocationRefresh() {
    setBusy('location');
    setError('');
    setMessage('');
    try {
      await saveCurrentLocation();
    } catch (locationError) {
      setError(
        locationError.response?.data?.error?.message ??
          locationError.message ??
          'Could not update your location.',
      );
    } finally {
      setBusy('');
    }
  }

  async function handleAvailability(status) {
    setBusy('availability');
    setError('');
    setMessage('');

    try {
      if (status === 'AVAILABLE_NOW') {
        await saveCurrentLocation({ quiet: true });
      }

      const { data } = await api.patch('/partner/availability', { status });
      setOperational(data.data.partner);
      await refreshSession();
      setMessage(
        status === 'AVAILABLE_NOW'
          ? 'You are now visible as nearby delivery supply.'
          : 'You are offline. RouteBite will not match new nearby requests to you.',
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          requestError.message ??
          'Could not change availability.',
      );
    } finally {
      setBusy('');
    }
  }

  function useCurrentLocationForOrigin() {
    setBusy('origin-location');
    setError('');
    setMessage('');

    getBrowserLocation()
      .then((location) => {
        setTripForm((current) => ({
          ...current,
          originLatitude: String(location.latitude),
          originLongitude: String(location.longitude),
          originLabel: current.originLabel || 'My current location',
        }));
        setMessage('Current position copied into the trip origin.');
      })
      .catch((locationError) => setError(locationError.message))
      .finally(() => setBusy(''));
  }

  async function handleCreateTrip(event) {
    event.preventDefault();
    setBusy('create-trip');
    setError('');
    setMessage('');

    try {
      const payload = {
        origin: {
          label: tripForm.originLabel,
          latitude: Number(tripForm.originLatitude),
          longitude: Number(tripForm.originLongitude),
        },
        destination: {
          label: tripForm.destinationLabel,
          latitude: Number(tripForm.destinationLatitude),
          longitude: Number(tripForm.destinationLongitude),
        },
        scheduledDepartureAt: new Date(tripForm.scheduledDepartureAt).toISOString(),
        departureFlexMinutes: Number(tripForm.departureFlexMinutes),
      };

      const { data } = await api.post('/partner/trips', payload);
      setTrips((current) => [data.data.trip, ...current]);
      setTripForm(EMPTY_TRIP_FORM);
      setMessage('Trip scheduled. It is separate from Available Now supply.');
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not schedule this trip.',
      );
    } finally {
      setBusy('');
    }
  }

  async function runTripAction(tripId, action) {
    setBusy(`${action}:${tripId}`);
    setError('');
    setMessage('');

    try {
      const { data } = await api.post(`/partner/trips/${tripId}/${action}`);
      setTrips((current) =>
        current.map((trip) => (trip.id === tripId ? data.data.trip : trip)),
      );

      if (action === 'start') {
        setOperational((current) =>
          current ? { ...current, availabilityStatus: 'OFFLINE' } : current,
        );
        await refreshSession();
      }

      setMessage(
        action === 'start'
          ? 'Trip started. Available Now has been turned off.'
          : action === 'complete'
            ? 'Trip completed.'
            : 'Trip cancelled.',
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          `Could not ${action} this trip.`,
      );
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return <main className="partner-workspace"><p>Loading partner workspace…</p></main>;
  }

  const isAvailable = operational?.availabilityStatus === 'AVAILABLE_NOW';

  return (
    <main className="partner-workspace">
      <header className="partner-workspace-header">
        <div>
          <p className="eyebrow">RouteBite partner</p>
          <h1>Where are you heading?</h1>
          <p>
            Go online for nearby requests, or publish a future route when you are already travelling somewhere.
          </p>
        </div>
        <div className="partner-header-actions">
          <Link className="secondary-link" to="/account">Account</Link>
          <Link className="secondary-link" to="/">Home</Link>
        </div>
      </header>

      {message ? <p className="success-message partner-flash">{message}</p> : null}
      {error ? <p className="form-error partner-flash">{error}</p> : null}

      <section className="partner-mode-grid">
        <article className={`partner-mode-card ${isAvailable ? 'is-live' : ''}`}>
          <div className="partner-mode-icon" aria-hidden="true">●</div>
          <p className="eyebrow">Available to deliver</p>
          <h2>{isAvailable ? 'You’re live nearby' : 'Go online around you'}</h2>
          <p>
            RouteBite can consider you for dedicated nearby deliveries while this mode is active.
          </p>

          <div className="partner-location-box">
            <span>Current location</span>
            {operational?.currentLocation ? (
              <strong>
                {operational.currentLocation.latitude.toFixed(5)}, {' '}
                {operational.currentLocation.longitude.toFixed(5)}
              </strong>
            ) : (
              <strong>Not shared yet</strong>
            )}
            <small>
              {operational?.currentLocation?.updatedAt
                ? `Updated ${formatDate(operational.currentLocation.updatedAt)}`
                : 'RouteBite needs a recent location before you can go live.'}
            </small>
          </div>

          <div className="partner-mode-actions">
            <button
              className="primary-button"
              type="button"
              disabled={busy === 'availability' || Boolean(activeTrip)}
              onClick={() => handleAvailability(isAvailable ? 'OFFLINE' : 'AVAILABLE_NOW')}
            >
              {busy === 'availability'
                ? 'Updating…'
                : isAvailable
                  ? 'Go offline'
                  : 'Go available now'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={busy === 'location'}
              onClick={handleLocationRefresh}
            >
              {busy === 'location' ? 'Locating…' : 'Refresh location'}
            </button>
          </div>

          {activeTrip ? (
            <p className="partner-mode-note">Finish your active trip before switching to Available Now.</p>
          ) : null}
        </article>

        <article className={`partner-mode-card route-mode-card ${activeTrip ? 'is-route-active' : ''}`}>
          <div className="route-mini-visual" aria-hidden="true">
            <span className="route-mini-pin" />
            <span className="route-mini-line" />
            <span className="route-mini-rider">→</span>
            <span className="route-mini-pin destination" />
          </div>
          <p className="eyebrow">On my way</p>
          <h2>{activeTrip ? 'Your route is active' : 'Publish a route you already plan to take'}</h2>
          <p>
            Scheduled trips are matched by direction and time later. Creating one does not make you nearby on-demand supply.
          </p>
          {activeTrip ? (
            <div className="active-route-summary">
              <strong>{activeTrip.origin.label}</strong>
              <span>→</span>
              <strong>{activeTrip.destination.label}</strong>
            </div>
          ) : (
            <div className="active-route-summary muted-route-summary">
              <span>Origin</span><span>→</span><span>Destination</span>
            </div>
          )}
        </article>
      </section>

      <section className="partner-section-card">
        <div className="partner-section-heading">
          <div>
            <p className="eyebrow">Plan a journey</p>
            <h2>Schedule an On My Way trip</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={useCurrentLocationForOrigin}
            disabled={busy === 'origin-location'}
          >
            {busy === 'origin-location' ? 'Locating…' : 'Use my location as origin'}
          </button>
        </div>

        <form className="trip-form" onSubmit={handleCreateTrip}>
          <div className="trip-endpoint-panel">
            <span className="trip-dot pickup-dot" />
            <label>
              Starting from
              <input
                value={tripForm.originLabel}
                onChange={(event) => setTripForm({ ...tripForm, originLabel: event.target.value })}
                placeholder="Civil Lines"
                required
              />
            </label>
            <div className="coordinate-grid">
              <label>Latitude<input type="number" step="any" min="-90" max="90" value={tripForm.originLatitude} onChange={(event) => setTripForm({ ...tripForm, originLatitude: event.target.value })} required /></label>
              <label>Longitude<input type="number" step="any" min="-180" max="180" value={tripForm.originLongitude} onChange={(event) => setTripForm({ ...tripForm, originLongitude: event.target.value })} required /></label>
            </div>
          </div>

          <div className="trip-form-route-line" aria-hidden="true" />

          <div className="trip-endpoint-panel">
            <span className="trip-dot destination-dot" />
            <label>
              Heading to
              <input
                value={tripForm.destinationLabel}
                onChange={(event) => setTripForm({ ...tripForm, destinationLabel: event.target.value })}
                placeholder="IIIT Allahabad"
                required
              />
            </label>
            <div className="coordinate-grid">
              <label>Latitude<input type="number" step="any" min="-90" max="90" value={tripForm.destinationLatitude} onChange={(event) => setTripForm({ ...tripForm, destinationLatitude: event.target.value })} required /></label>
              <label>Longitude<input type="number" step="any" min="-180" max="180" value={tripForm.destinationLongitude} onChange={(event) => setTripForm({ ...tripForm, destinationLongitude: event.target.value })} required /></label>
            </div>
          </div>

          <div className="trip-time-grid">
            <label>
              Departure time
              <input
                type="datetime-local"
                value={tripForm.scheduledDepartureAt}
                onChange={(event) => setTripForm({ ...tripForm, scheduledDepartureAt: event.target.value })}
                required
              />
            </label>
            <label>
              Flexible by
              <select
                value={tripForm.departureFlexMinutes}
                onChange={(event) => setTripForm({ ...tripForm, departureFlexMinutes: event.target.value })}
              >
                <option value="0">Exact time</option>
                <option value="10">± 10 minutes</option>
                <option value="15">± 15 minutes</option>
                <option value="30">± 30 minutes</option>
                <option value="60">± 60 minutes</option>
              </select>
            </label>
          </div>

          <button className="primary-button trip-submit-button" type="submit" disabled={busy === 'create-trip'}>
            {busy === 'create-trip' ? 'Scheduling…' : 'Publish this route'}
          </button>
        </form>
      </section>

      <section className="partner-section-card">
        <div className="partner-section-heading">
          <div>
            <p className="eyebrow">Your routes</p>
            <h2>Trips</h2>
          </div>
          <span className="trip-count">{trips.length} total</span>
        </div>

        {trips.length === 0 ? (
          <div className="partner-empty-state">
            <strong>No routes yet.</strong>
            <span>Schedule a journey above when you already know where you are going.</span>
          </div>
        ) : (
          <div className="trip-list">
            {trips.map((trip) => (
              <article className="trip-card" key={trip.id}>
                <div className="trip-card-route">
                  <span className="trip-dot pickup-dot" />
                  <div>
                    <strong>{trip.origin.label}</strong>
                    <small>{trip.origin.latitude.toFixed(4)}, {trip.origin.longitude.toFixed(4)}</small>
                  </div>
                  <span className="trip-card-arrow">→</span>
                  <span className="trip-dot destination-dot" />
                  <div>
                    <strong>{trip.destination.label}</strong>
                    <small>{trip.destination.latitude.toFixed(4)}, {trip.destination.longitude.toFixed(4)}</small>
                  </div>
                </div>

                <div className="trip-card-meta">
                  <span>{formatDate(trip.scheduledDepartureAt)}</span>
                  <span>± {trip.departureFlexMinutes} min</span>
                  <strong className={`trip-status ${trip.status.toLowerCase()}`}>
                    {statusLabel(trip.status)}
                  </strong>
                </div>

                {trip.status === 'TRIP_SCHEDULED' ? (
                  <div className="trip-card-actions">
                    <button className="primary-button compact-button" type="button" disabled={Boolean(busy)} onClick={() => runTripAction(trip.id, 'start')}>Start trip</button>
                    <button className="secondary-button compact-button" type="button" disabled={Boolean(busy)} onClick={() => runTripAction(trip.id, 'cancel')}>Cancel</button>
                  </div>
                ) : null}

                {trip.status === 'TRIP_ACTIVE' ? (
                  <div className="trip-card-actions">
                    <button className="primary-button compact-button" type="button" disabled={Boolean(busy)} onClick={() => runTripAction(trip.id, 'complete')}>Complete trip</button>
                    <button className="secondary-button compact-button" type="button" disabled={Boolean(busy)} onClick={() => runTripAction(trip.id, 'cancel')}>Cancel trip</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
