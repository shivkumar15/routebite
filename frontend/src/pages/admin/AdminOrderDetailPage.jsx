import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios.js';

function money(paise) {
  if (paise == null) return '—';
  return `₹${(Number(paise) / 100).toFixed(2)}`;
}

function when(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function readable(value) {
  if (!value) return '—';
  return String(value).replaceAll('_', ' ');
}

function rejectionText(summary = {}) {
  const entries = Object.entries(summary);
  if (entries.length === 0) return 'No hard-filter rejections recorded.';
  return entries.map(([reason, count]) => `${readable(reason)} × ${count}`).join(' · ');
}

function DataRow({ label, value }) {
  return (
    <div className="admin-data-row">
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const { orderId } = useParams();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/admin/orders/${orderId}`)
      .then(({ data }) => {
        if (active) setDetail(data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error?.message ?? 'Could not load this order.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [orderId]);

  if (loading) {
    return <main className="admin-ops-shell"><div className="admin-empty-panel">Loading order investigation…</div></main>;
  }

  if (error || !detail) {
    return (
      <main className="admin-ops-shell">
        <p className="form-error">{error || 'Order detail is unavailable.'}</p>
        <Link className="secondary-link" to="/admin/orders">Back to operations</Link>
      </main>
    );
  }

  const { order, customer, assignedPartner, payments, matchingAttempts, offers, earning, timeline } = detail;

  return (
    <main className="admin-ops-shell">
      <section className="admin-detail-header">
        <div>
          <div className="admin-detail-kicker">
            <span className={`admin-status-pill status-${order.status.toLowerCase()}`}>{readable(order.status)}</span>
            <span>Order #{order.shortId}</span>
          </div>
          <h1>{order.vendorDisplayName}</h1>
          <p>{order.pickup?.label} <span>→</span> {order.drop?.label}</p>
        </div>
        <div className="admin-ops-nav">
          <Link className="secondary-link" to="/admin/orders">Order queue</Link>
          <Link className="secondary-link" to="/admin/partners">Partner reviews</Link>
        </div>
      </section>

      {order.status === 'ADMIN_REVIEW_REQUIRED' ? (
        <section className="admin-review-banner">
          <div>
            <p className="eyebrow">Human review required</p>
            <h2>{readable(order.recovery.lastEvent)}</h2>
          </div>
          <p>{order.recovery.reason || 'This order was routed to operations review.'}</p>
        </section>
      ) : null}

      <section className="admin-detail-grid">
        <article className="admin-detail-card span-two">
          <div className="admin-card-title">
            <div><p className="eyebrow">Request</p><h2>Order facts</h2></div>
            <span>{when(order.timestamps.createdAt)}</span>
          </div>
          <div className="admin-fact-grid">
            <DataRow label="Requested items" value={order.requestedItems} />
            <DataRow label="Pickup instructions" value={order.pickupInstructions || 'None'} />
            <DataRow label="Delivery type" value={order.deliveryType} />
            <DataRow label="Delivery window" value={`${when(order.deliveryWindowStart)} → ${when(order.deliveryWindowEnd)}`} />
            <DataRow label="Pickup coordinates" value={`${order.pickup.latitude}, ${order.pickup.longitude}`} />
            <DataRow label="Drop coordinates" value={`${order.drop.latitude}, ${order.drop.longitude}`} />
          </div>
        </article>

        <article className="admin-detail-card">
          <div className="admin-card-title"><div><p className="eyebrow">Customer</p><h2>{customer?.name ?? 'Unavailable'}</h2></div></div>
          <div className="admin-stack-data">
            <DataRow label="Email" value={customer?.email} />
            <DataRow label="Phone" value={customer?.phone} />
            <DataRow label="Email verified" value={customer?.emailVerified ? 'Yes' : 'No'} />
            <DataRow label="Phone verified" value={customer?.phoneVerified ? 'Yes' : 'No'} />
          </div>
        </article>

        <article className="admin-detail-card">
          <div className="admin-card-title"><div><p className="eyebrow">Assigned partner</p><h2>{assignedPartner?.user?.name ?? 'Unassigned'}</h2></div></div>
          <div className="admin-stack-data">
            <DataRow label="Partner ID" value={assignedPartner?.id ? `#${assignedPartner.id.slice(-6).toUpperCase()}` : null} />
            <DataRow label="Email" value={assignedPartner?.user?.email} />
            <DataRow label="Verification" value={readable(assignedPartner?.verificationStatus)} />
            <DataRow label="Availability" value={readable(assignedPartner?.availabilityStatus)} />
            <DataRow label="Completed / cancelled" value={assignedPartner ? `${assignedPartner.completedOrderCount} / ${assignedPartner.cancelledOrderCount}` : null} />
          </div>
        </article>

        <article className="admin-detail-card span-two">
          <div className="admin-card-title">
            <div><p className="eyebrow">Prototype money</p><h2>Payment & accounting state</h2></div>
            <span>{payments.length} payment attempt{payments.length === 1 ? '' : 's'}</span>
          </div>

          <div className="admin-money-grid">
            <div><span>Estimated food</span><strong>{money(order.pricing.estimatedFoodCostPaise)}</strong></div>
            <div><span>Delivery charge</span><strong>{money(order.pricing.customerDeliveryChargePaise)}</strong></div>
            <div><span>Platform fee</span><strong>{money(order.pricing.platformFeePaise)}</strong></div>
            <div><span>Estimated total</span><strong>{money(order.pricing.estimatedCustomerTotalPaise)}</strong></div>
            <div><span>Final demo total</span><strong>{money(order.pricing.finalCustomerTotalPaise)}</strong></div>
            <div><span>Partner earning</span><strong>{money(earning?.totalEarningPaise)}</strong></div>
          </div>

          <div className="admin-sublist">
            {payments.map((payment) => (
              <div className="admin-sublist-row" key={payment.id}>
                <div>
                  <strong>{readable(payment.status)}</strong>
                  <span>{payment.provider} · {payment.mode} · {money(payment.amountPaise)}</span>
                </div>
                <div>
                  <span>{payment.providerPaymentId || payment.providerOrderId || 'Provider ID pending'}</span>
                  <small>{when(payment.confirmedAt || payment.failedAt || payment.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-detail-card span-two">
          <div className="admin-card-title">
            <div><p className="eyebrow">Matching</p><h2>Attempts and hard filters</h2></div>
            <span>{matchingAttempts.length} attempt{matchingAttempts.length === 1 ? '' : 's'}</span>
          </div>
          {matchingAttempts.length === 0 ? <p className="admin-muted">Matching has not produced an attempt document for this order.</p> : null}
          <div className="admin-attempt-list">
            {matchingAttempts.map((attempt) => (
              <article className="admin-attempt-card" key={attempt.id}>
                <div className="admin-attempt-top">
                  <strong>Attempt {attempt.attemptNumber} · {readable(attempt.status)}</strong>
                  <span>{when(attempt.completedAt || attempt.createdAt)}</span>
                </div>
                <div className="admin-attempt-numbers">
                  <span><strong>{attempt.discoveredCandidateCount}</strong> discovered</span>
                  <span><strong>{attempt.eligibleCandidateCount}</strong> eligible</span>
                  <span><strong>{attempt.offerReadyCount}</strong> offer-ready</span>
                </div>
                <p>{rejectionText(attempt.rejectionSummary)}</p>
                {attempt.failureReason ? <div className="admin-inline-warning">{attempt.failureReason}</div> : null}
              </article>
            ))}
          </div>
        </article>

        <article className="admin-detail-card span-two">
          <div className="admin-card-title">
            <div><p className="eyebrow">Dispatch</p><h2>Offer history</h2></div>
            <span>{offers.length} offer{offers.length === 1 ? '' : 's'}</span>
          </div>
          {offers.length === 0 ? <p className="admin-muted">No partner offer was dispatched.</p> : null}
          <div className="admin-offer-table-wrap">
            <table className="admin-offer-table">
              <thead><tr><th>Partner</th><th>Mode</th><th>Rank</th><th>Status</th><th>Created</th><th>Resolved</th></tr></thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id}>
                    <td>#{offer.partnerShortId}</td>
                    <td>{readable(offer.partnerMode)}</td>
                    <td>{offer.rankPosition}</td>
                    <td><span className={`admin-status-pill offer-${offer.status.toLowerCase()}`}>{readable(offer.status)}</span></td>
                    <td>{when(offer.createdAt)}</td>
                    <td>{when(offer.respondedAt || offer.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="admin-detail-card">
          <div className="admin-card-title"><div><p className="eyebrow">Pickup</p><h2>Price adjustment</h2></div></div>
          <div className="admin-stack-data">
            <DataRow label="Status" value={readable(order.priceAdjustment.status)} />
            <DataRow label="Actual food cost" value={money(order.priceAdjustment.actualFoodCostPaise)} />
            <DataRow label="Difference" value={order.priceAdjustment.differencePaise == null ? '—' : money(order.priceAdjustment.differencePaise)} />
            <DataRow label="Reported" value={when(order.priceAdjustment.reportedAt)} />
            <DataRow label="Resolved" value={when(order.priceAdjustment.resolvedAt)} />
          </div>
          {order.priceAdjustment.receiptUrl ? (
            <a className="secondary-link compact-button" href={order.priceAdjustment.receiptUrl} target="_blank" rel="noreferrer">Open receipt / proof</a>
          ) : null}
        </article>

        <article className="admin-detail-card">
          <div className="admin-card-title"><div><p className="eyebrow">Recovery</p><h2>{readable(order.recovery.lastEvent)}</h2></div></div>
          <div className="admin-stack-data">
            <DataRow label="Actor" value={readable(order.recovery.lastActor)} />
            <DataRow label="Reason" value={order.recovery.reason} />
            <DataRow label="Occurred" value={when(order.recovery.occurredAt)} />
            <DataRow label="Rematch count" value={String(order.recovery.rematchCount)} />
            <DataRow label="Excluded partners" value={order.recovery.excludedPartnerIds.length ? order.recovery.excludedPartnerIds.map((id) => `#${id.slice(-6).toUpperCase()}`).join(', ') : 'None'} />
          </div>
        </article>

        <article className="admin-detail-card span-two timeline-card">
          <div className="admin-card-title">
            <div><p className="eyebrow">Operational story</p><h2>Timeline</h2></div>
            <span>Derived from persisted timestamps</span>
          </div>
          <div className="admin-timeline">
            {timeline.map((event, index) => (
              <div className={`admin-timeline-event tone-${event.tone}`} key={`${event.type}-${event.at}-${index}`}>
                <div className="admin-timeline-dot" />
                <div>
                  <span>{when(event.at)}</span>
                  <strong>{event.title}</strong>
                  {event.detail ? <p>{event.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
