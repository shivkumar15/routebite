import { useEffect, useState } from 'react';

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.max(0, Math.round(meters))} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function formatTime(value) {
  if (!value) return 'Waiting for first GPS update';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function LiveTrackingCard({ tracking, dropLabel }) {
  const [now, setNow] = useState(Date.now());
  const trackingActive = Boolean(tracking?.active);
  const location = tracking?.location ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const clientStale = Boolean(
    location?.updatedAt && now - new Date(location.updatedAt).getTime() > 45000,
  );
  const stale = Boolean(location?.stale || clientStale);

  let badgeLabel = 'Waiting for GPS';
  if (trackingActive && location) {
    badgeLabel = stale ? 'Location delayed' : 'Live';
  } else if (trackingActive) {
    badgeLabel = 'Connecting';
  }

  return (
    <section className="live-tracking-card" aria-live="polite">
      <div className="live-tracking-heading">
        <div>
          <p className="eyebrow">Live delivery</p>
          <h3>Partner is on the way</h3>
        </div>
        <span
          className={`live-tracking-badge ${stale || !trackingActive ? 'is-stale' : ''}`}
        >
          <span aria-hidden="true" />
          {badgeLabel}
        </span>
      </div>

      <div className="live-route-visual" aria-hidden="true">
        <span className="live-route-origin">Food</span>
        <span className="live-route-line"><i /></span>
        <span className="live-route-rider">→</span>
        <span className="live-route-destination">You</span>
      </div>

      {location ? (
        <div className="live-tracking-grid">
          <div>
            <span>Latest position</span>
            <strong>{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</strong>
          </div>
          <div>
            <span>Approx. distance to {dropLabel || 'drop'}</span>
            <strong>{formatDistance(location.distanceToDropMeters)}</strong>
          </div>
          <div>
            <span>GPS accuracy</span>
            <strong>{location.accuracyMeters != null ? `± ${Math.round(location.accuracyMeters)} m` : '—'}</strong>
          </div>
          <div>
            <span>Last update</span>
            <strong>{formatTime(location.updatedAt)}</strong>
          </div>
        </div>
      ) : (
        <p className="live-tracking-waiting">
          Delivery has started. Waiting for the partner browser's first foreground GPS update. Keep the partner page open and allow location permission.
        </p>
      )}

      <p className="live-tracking-note">
        Distance is a straight-line approximation for the prototype. RouteBite does not call Google Routes on every GPS update.
      </p>
    </section>
  );
}
