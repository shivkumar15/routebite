function formatMoney(paise) {
  return `₹${(Number(paise) / 100).toFixed(2)}`;
}

export default function ActiveDeliveryCard({ order }) {
  if (!order) return null;

  return (
    <section className="partner-section-card active-delivery-card">
      <div className="partner-section-heading">
        <div>
          <p className="eyebrow">Active delivery</p>
          <h2>You accepted this request</h2>
        </div>
        <span className="order-status-chip">{order.status}</span>
      </div>

      <div className="active-delivery-summary">
        <div>
          <span className="active-delivery-label">Food place</span>
          <strong>{order.vendorDisplayName}</strong>
          <p>{order.requestedItems}</p>
        </div>

        <div className="active-delivery-route">
          <div>
            <span className="active-delivery-label">Pickup</span>
            <strong>{order.pickup.label}</strong>
            <small>{order.pickup.latitude.toFixed(5)}, {order.pickup.longitude.toFixed(5)}</small>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <span className="active-delivery-label">Drop</span>
            <strong>{order.drop.label}</strong>
            <small>{order.drop.latitude.toFixed(5)}, {order.drop.longitude.toFixed(5)}</small>
          </div>
        </div>

        {order.pickupInstructions ? (
          <div>
            <span className="active-delivery-label">Pickup instructions</span>
            <p>{order.pickupInstructions}</p>
          </div>
        ) : null}

        <div className="active-delivery-footer">
          <span>Expected earning <strong>{formatMoney(order.expectedEarningPaise)}</strong></span>
          <span>Order #{order.id.slice(-6).toUpperCase()}</span>
        </div>
      </div>

      <div className="active-delivery-next-step">
        <strong>This is your delivery job — not an On My Way trip.</strong>
        <p>
          RouteBite has locked this order to you, so you stay unavailable for new requests. The next delivery action is <b>Start pickup</b>, which is the Phase 8 ASSIGNED → PARTNER_TO_PICKUP flow.
        </p>
      </div>
    </section>
  );
}
