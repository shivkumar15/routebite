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
  if (!tracking?.active) return null;

  const location = tracking.location;

  return (
    <section className="live-tracking-card" aria-live="polite">
      <div className="live-tracking-heading">
        <div>
          <p className="eyebrow">Live delivery</p>
          <h3>Partner is on the way</h3>
        </div>
        <span className={`live-tracking-badge ${location?.stale ? 'is-stale' : ''}`}>
          <span aria-hidden="true" />
          {location?.stale ? 'Location delayed' : 'Live'}
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
          Delivery has started. Waiting for the partner browser's first foreground GPS update.
        </p>
      )}

      <p className="live-tracking-note">
        Distance is a straight-line approximation for the prototype. RouteBite does not call Google Routes on every GPS update.
      </p>
    </section>
  );
}
