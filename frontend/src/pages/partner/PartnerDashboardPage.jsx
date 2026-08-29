import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';
import LocationPicker from '../../components/location/LocationPicker.jsx';
import ActiveDeliveryCard from '../../components/partner/ActiveDeliveryCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { isCompleteLocation, locationToApiPayload } from '../../utils/location.js';

function createEmptyTripForm() {
  return {
    origin: { label: '', latitude: '', longitude: '' },
    destination: { label: '', latitude: '', longitude: '' },
    scheduledDepartureAt: '',
    departureFlexMinutes: '15',
  };
}

function getBrowserLocation({ maximumAge = 15000 } = {}) {
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
        maximumAge,
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
  const [activeOrder, setActiveOrder] = useState(null);
  const [trips, setTrips] = useState([]);
  const [tripForm, setTripForm] = useState(createEmptyTripForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [trackingIssue, setTrackingIssue] = useState('');
  const [availabilityLocationIssue, setAvailabilityLocationIssue] = useState('');

  const activeTrip = useMemo(
    () => trips.find((trip) => trip.status === 'TRIP_ACTIVE') ?? null,
    [trips],
  );

  async function loadDashboard() {
    setError('');
    try {
      const [operationalResponse, activeOrderResponse, tripsResponse] = await Promise.all([
        api.get('/partner/operational-state'),
        api.get('/partner/active-order'),
        api.get('/partner/trips'),
      ]);
      setOperational(operationalResponse.data.data.partner);
      setActiveOrder(activeOrderResponse.data.data.order);
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

  useEffect(() => {
    if (operational?.availabilityStatus !== 'AVAILABLE_NOW' || activeOrder) {
      setAvailabilityLocationIssue('');
      return undefined;
    }

    let active = true;

    async function pushAvailableLocation() {
      try {
        const location = await getBrowserLocation({ maximumAge: 3000 });
        const { data } = await api.put('/partner/location', location);
        if (!active) return;
        setOperational(data.data.partner);
        setAvailabilityLocationIssue('');
      } catch (locationError) {
        if (!active) return;
        setAvailabilityLocationIssue(
          locationError.response?.data?.error?.message ??
            locationError.message ??
            'Available Now location could not be refreshed.',
        );
      }
    }

    const timer = window.setInterval(pushAvailableLocation, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [operational?.availabilityStatus, activeOrder?.id]);

  useEffect(() => {
    if (activeOrder?.status !== 'OUT_FOR_DELIVERY') {
      setTrackingIssue('');
      return undefined;
    }

    let active = true;

    async function pushDeliveryLocation() {
      try {
        const location = await getBrowserLocation({ maximumAge: 3000 });
        const { data } = await api.put('/partner/active-order/location', location);
        if (!active) return;
        const latest = data.data.tracking.location;
        if (latest) {
          setOperational((current) =>
            current
              ? {
                  ...current,
                  currentLocation: {
                    latitude: latest.latitude,
                    longitude: latest.longitude,
                    accuracyMeters: latest.accuracyMeters,
                    updatedAt: latest.updatedAt,
                  },
                }
              : current,
          );
        }
        setTrackingIssue('');
      } catch (locationError) {
        if (!active) return;
        setTrackingIssue(
          locationError.response?.data?.error?.message ??
            locationError.message ??
            'Live delivery location could not be updated.',
        );
      }
    }

    pushDeliveryLocation();
    const timer = window.setInterval(pushDeliveryLocation, 12000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeOrder?.id, activeOrder?.status]);

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

  async function handleCreateTrip(event) {
    event.preventDefault();
    setBusy('create-trip');
    setError('');
    setMessage('');

    try {
      if (!isCompleteLocation(tripForm.origin) || !isCompleteLocation(tripForm.destination)) {
        setError('Select both trip origin and destination, including clear location names.');
        setBusy('');
        return;
      }

      const payload = {
        origin: locationToApiPayload(tripForm.origin),
        destination: locationToApiPayload(tripForm.destination),
        scheduledDepartureAt: new Date(tripForm.scheduledDepartureAt).toISOString(),
        departureFlexMinutes: Number(tripForm.departureFlexMinutes),
      };

      const { data } = await api.post('/partner/trips', payload);
      setTrips((current) => [data.data.trip, ...current]);
      setTripForm(createEmptyTripForm());
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
          ? 'Planned On My Way route started. Available Now has been turned off.'
          : action === 'complete'
            ? 'Planned route completed.'
            : 'Planned route cancelled.',
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          `Could not ${action} this planned route.`,
      );
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return <main className="partner-workspace"><p>Loading partner workspace…</p></main>;
  }

  const isAvailable = operational?.availabilityStatus === 'AVAILABLE_NOW';
  const handlingDelivery = Boolean(activeOrder);

  return (
    <main className="partner-workspace">
      <header className="partner-workspace-header">
        <div>
          <p className="eyebrow">RouteBite partner</p>
          <h1>{handlingDelivery ? 'Your active delivery' : 'Where are you heading?'}</h1>
          <p>
            {handlingDelivery
              ? 'This accepted request is locked to you. Finish its delivery flow before taking another request.'
              : 'Go online for nearby requests, or publish a future route when you are already travelling somewhere.'}
          </p>
        </div>
        <div className="partner-header-actions">
          <Link className="secondary-link" to="/partner/offers">Delivery offers</Link>
          <Link className="secondary-link" to="/account">Account</Link>
          <Link className="secondary-link" to="/">Home</Link>
        </div>
      </header>

      {message ? <p className="success-message partner-flash">{message}</p> : null}
      {error ? <p className="form-error partner-flash">{error}</p> : null}
      {availabilityLocationIssue ? (
        <p className="form-error partner-flash">
          Available Now location: {availabilityLocationIssue}
        </p>
      ) : null}
      {trackingIssue ? <p className="form-error partner-flash">Tracking: {trackingIssue}</p> : null}

      <ActiveDeliveryCard order={activeOrder} onOrderChange={setActiveOrder} />

      <section className="partner-mode-grid">
        <article className={`partner-mode-card ${isAvailable ? 'is-live' : ''}`}>
          <div className="partner-mode-icon" aria-hidden="true">●</div>
          <p className="eyebrow">Available to deliver</p>
          <h2>
            {handlingDelivery
              ? 'Busy with an accepted delivery'
              : isAvailable
                ? 'You’re live nearby'
                : 'Go online around you'}
          </h2>
          <p>
            {handlingDelivery
              ? 'RouteBite keeps you offline for new requests while this delivery is active.'
              : 'RouteBite can consider you for dedicated nearby deliveries while this mode is active.'}
          </p>

          <div className="partner-location-box">
            <span>Current location</span>
            {operational?.currentLocation ? (
              <strong>Location sharing active</strong>
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
              disabled={busy === 'availability' || Boolean(activeTrip) || handlingDelivery}
              onClick={() => handleAvailability(isAvailable ? 'OFFLINE' : 'AVAILABLE_NOW')}
            >
              {busy === 'availability'
                ? 'Updating…'
                : handlingDelivery
                  ? 'Busy with delivery'
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

          {handlingDelivery ? (
            <p className="partner-mode-note">Complete the accepted delivery before going Available Now again.</p>
          ) : activeTrip ? (
            <p className="partner-mode-note">Finish your active planned route before switching to Available Now.</p>
          ) : null}
        </article>

        <article className={`partner-mode-card route-mode-card ${activeTrip ? 'is-route-active' : ''}`}>
          <div className="route-mini-visual" aria-hidden="true">
            <span className="route-mini-pin" />
            <span className="route-mini-line" />
            <span className="route-mini-rider">→</span>
            <span className="route-mini-pin destination" />
          </div>
          <p className="eyebrow">On my way · planned route</p>
          <h2>{activeTrip ? 'Your planned route is active' : 'Publish a route you already plan to take'}</h2>
          <p>
            This is your own A → B travel route used for matching. It is separate from an accepted delivery job.
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
            <p className="eyebrow">Plan your own journey</p>
            <h2>Schedule an On My Way route</h2>
          </div>
        </div>

        {handlingDelivery ? (
          <p className="partner-mode-note">Your accepted delivery is active. Planned-route actions are paused until that delivery finishes.</p>
        ) : null}

        <form className="trip-form" onSubmit={handleCreateTrip}>
          <LocationPicker
            label="Starting from"
            description="Choose where your planned journey begins."
            purpose="trip origin"
            value={tripForm.origin}
            onChange={(origin) => setTripForm((current) => ({ ...current, origin }))}
            disabled={handlingDelivery}
          />

          <div className="trip-form-route-line" aria-hidden="true" />

          <LocationPicker
            label="Heading to"
            description="Choose the destination you already plan to travel toward."
            purpose="trip destination"
            value={tripForm.destination}
            onChange={(destination) => setTripForm((current) => ({ ...current, destination }))}
            disabled={handlingDelivery}
          />

          <div className="trip-time-grid">
            <label>
              Departure time
              <input
                type="datetime-local"
                value={tripForm.scheduledDepartureAt}
                onChange={(event) => setTripForm({ ...tripForm, scheduledDepartureAt: event.target.value })}
                required
                disabled={handlingDelivery}
              />
            </label>
            <label>
              Flexible by
              <select
                value={tripForm.departureFlexMinutes}
                onChange={(event) => setTripForm({ ...tripForm, departureFlexMinutes: event.target.value })}
                disabled={handlingDelivery}
              >
                <option value="0">Exact time</option>
                <option value="10">± 10 minutes</option>
                <option value="15">± 15 minutes</option>
                <option value="30">± 30 minutes</option>
                <option value="60">± 60 minutes</option>
              </select>
            </label>
          </div>

          <button className="primary-button trip-submit-button" type="submit" disabled={busy === 'create-trip' || handlingDelivery}>
            {busy === 'create-trip' ? 'Scheduling…' : handlingDelivery ? 'Finish active delivery first' : 'Publish this route'}
          </button>
        </form>
      </section>

      <section className="partner-section-card">
        <div className="partner-section-heading">
          <div>
            <p className="eyebrow">Your planned routes</p>
            <h2>On My Way routes</h2>
          </div>
          <span className="trip-count">{trips.length} total</span>
        </div>

        {trips.length === 0 ? (
          <div className="partner-empty-state">
            <strong>No planned routes yet.</strong>
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
                  </div>
                  <span className="trip-card-arrow">→</span>
                  <span className="trip-dot destination-dot" />
                  <div>
                    <strong>{trip.destination.label}</strong>
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
                    <button className="primary-button compact-button" type="button" disabled={Boolean(busy) || handlingDelivery} onClick={() => runTripAction(trip.id, 'start')}>Start planned route</button>
                    <button className="secondary-button compact-button" type="button" disabled={Boolean(busy) || handlingDelivery} onClick={() => runTripAction(trip.id, 'cancel')}>Cancel planned route</button>
                  </div>
                ) : null}

                {trip.status === 'TRIP_ACTIVE' ? (
                  <div className="trip-card-actions">
                    <button className="primary-button compact-button" type="button" disabled={Boolean(busy) || handlingDelivery} onClick={() => runTripAction(trip.id, 'complete')}>Complete planned route</button>
                    <button className="secondary-button compact-button" type="button" disabled={Boolean(busy) || handlingDelivery} onClick={() => runTripAction(trip.id, 'cancel')}>Cancel planned route</button>
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
