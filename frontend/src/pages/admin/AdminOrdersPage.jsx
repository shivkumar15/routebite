import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';

const FILTERS = [
  ['ALL', 'All'],
  ['ATTENTION', 'Needs attention'],
  ['ADMIN_REVIEW_REQUIRED', 'Admin review'],
  ['MATCHING_FAILED', 'Matching failed'],
  ['FAILED', 'Failed'],
  ['ACTIVE', 'Active'],
  ['COMPLETED', 'Completed'],
  ['CANCELLED', 'Cancelled'],
];

function money(paise) {
  return `₹${(Number(paise ?? 0) / 100).toFixed(2)}`;
}

function when(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function readableStatus(value) {
  return String(value ?? '').replaceAll('_', ' ');
}

export default function AdminOrdersPage() {
  const [filter, setFilter] = useState('ATTENTION');
  const [payload, setPayload] = useState({ orders: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.get('/admin/orders', { params: { filter } })
      .then(({ data }) => {
        if (active) setPayload(data.data);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.error?.message ?? 'Could not load admin orders.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [filter]);

  const counts = payload.counts ?? {};

  return (
    <main className="admin-ops-shell">
      <section className="admin-ops-hero">
        <div>
          <p className="eyebrow">RouteBite operations</p>
          <h1>Know exactly why an order stopped.</h1>
          <p className="admin-ops-intro">
            Inspect customer, payment, matching, partner, recovery and delivery state without opening MongoDB.
          </p>
        </div>
        <div className="admin-ops-nav">
          <Link className="secondary-link" to="/admin/partners">Partner reviews</Link>
          <Link className="secondary-link" to="/account">Account</Link>
        </div>
      </section>

      <section className="admin-metric-grid" aria-label="Order operations summary">
        <article className="admin-metric-card danger-metric">
          <span>Needs attention</span>
          <strong>{counts.attention ?? 0}</strong>
          <small>Review + matching/terminal failures</small>
        </article>
        <article className="admin-metric-card">
          <span>Admin review</span>
          <strong>{counts.adminReview ?? 0}</strong>
          <small>Human decision required</small>
        </article>
        <article className="admin-metric-card">
          <span>Active</span>
          <strong>{counts.active ?? 0}</strong>
          <small>Payment through delivery</small>
        </article>
        <article className="admin-metric-card good-metric">
          <span>Completed</span>
          <strong>{counts.completed ?? 0}</strong>
          <small>Successfully finished orders</small>
        </article>
      </section>

      <section className="admin-ops-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">Order queue</p>
            <h2>{FILTERS.find(([value]) => value === filter)?.[1] ?? 'Orders'}</h2>
          </div>
          <span className="admin-result-count">{payload.orders.length} shown</span>
        </div>

        <div className="admin-filter-row">
          {FILTERS.map(([value, label]) => (
            <button
              className={`admin-filter-button ${filter === value ? 'is-active' : ''}`}
              type="button"
              key={value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <div className="admin-empty-panel">Loading operational orders…</div> : null}
        {!loading && !error && payload.orders.length === 0 ? (
          <div className="admin-empty-panel">No orders are in this queue right now.</div>
        ) : null}

        <div className="admin-order-list">
          {payload.orders.map((order) => (
            <article className="admin-order-card" key={order.id}>
              <div className="admin-order-topline">
                <div>
                  <span className={`admin-status-pill status-${order.status.toLowerCase()}`}>
                    {readableStatus(order.status)}
                  </span>
                  <span className="admin-order-id">#{order.shortId}</span>
                </div>
                <span>{when(order.createdAt)}</span>
              </div>

              <div className="admin-order-main">
                <div>
                  <h3>{order.vendorDisplayName}</h3>
                  <p>{order.pickupText} <span>→</span> {order.dropText}</p>
                  <p className="admin-order-customer">
                    {order.customer?.name ?? 'Unknown customer'} · {order.customer?.email ?? 'no email'}
                  </p>
                </div>
                <strong className="admin-order-money">{money(order.totalPaise)}</strong>
              </div>

              <div className="admin-order-meta-grid">
                <div><span>Payment</span><strong>{readableStatus(order.latestPayment?.status ?? 'NO PAYMENT')}</strong></div>
                <div><span>Partner</span><strong>{order.assignedPartnerShortId ? `#${order.assignedPartnerShortId}` : 'Unassigned'}</strong></div>
                <div><span>Delivery</span><strong>{order.deliveryType}</strong></div>
                <div><span>Rematches</span><strong>{order.recovery.rematchCount}</strong></div>
              </div>

              {order.stopReason ? (
                <div className="admin-recovery-callout">
                  <strong>{order.stopReason.title}</strong>
                  <span>{order.stopReason.reason}</span>
                  {order.stopReason.detail ? (
                    <span>{readableStatus(order.stopReason.detail)}</span>
                  ) : null}
                </div>
              ) : order.recovery.reason ? (
                <div className="admin-recovery-callout">
                  <strong>{readableStatus(order.recovery.lastEvent)}</strong>
                  <span>{order.recovery.reason}</span>
                </div>
              ) : null}

              <div className="admin-order-actions">
                <span>Window ends {when(order.deliveryWindowEnd)}</span>
                <Link className="primary-link compact-button" to={`/admin/orders/${order.id}`}>
                  Inspect order
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
