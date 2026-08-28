import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';

function formatMoney(paise) {
  return `₹${(Number(paise) / 100).toFixed(2)}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function postPaymentActionLabel(status) {
  if (status === 'OUT_FOR_DELIVERY' || status === 'DELIVERY_OTP_REQUIRED') {
    return 'Track delivery';
  }
  if (status === 'MATCHING') return 'Matching details';
  return 'View order';
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/orders')
      .then(({ data }) => {
        if (active) setOrders(data.data.orders);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.error?.message ?? 'Could not load your food requests.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  return (
    <main className="order-shell">
      <section className="orders-card">
        <div className="order-page-heading">
          <div>
            <p className="eyebrow">Your RouteBite requests</p>
            <h1>Food requests</h1>
            <p className="form-intro">Draft requests can now enter Razorpay Test Mode checkout. Matching begins only after backend payment confirmation.</p>
          </div>
          <div className="order-heading-actions">
            <Link className="secondary-link" to="/account">Account</Link>
            <Link className="primary-link" to="/orders/new">New request</Link>
          </div>
        </div>

        {loading ? <p>Loading requests…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        {!loading && !error && orders.length === 0 ? (
          <div className="empty-order-state">
            <h2>No food requests yet</h2>
            <p>Start with the local place you actually want food from.</p>
            <Link className="primary-link" to="/orders/new">Create your first request</Link>
          </div>
        ) : null}

        <div className="order-list">
          {orders.map((order) => {
            const canPay = ['DRAFT', 'AWAITING_PAYMENT'].includes(order.status);
            const postPayment = !canPay;

            return (
              <article className="order-summary-card" key={order.id}>
                <div className="order-summary-topline">
                  <span className="order-status-chip">{order.status}</span>
                  <span>{formatDate(order.createdAt)}</span>
                </div>
                <h2>{order.vendorDisplayName}</h2>
                <p>{order.requestedItems}</p>
                <div className="order-route-summary">
                  <span><strong>Pickup</strong>{order.pickup.label}</span>
                  <span className="route-arrow">→</span>
                  <span><strong>Drop</strong>{order.drop.label}</span>
                </div>
                <div className="order-summary-footer">
                  <span>{order.deliveryType === 'ASAP' ? 'ASAP' : `Scheduled · ${formatDate(order.deliveryWindowStart)}`}</span>
                  <strong>{formatMoney(order.pricing?.estimatedCustomerTotalPaise ?? order.estimatedFoodCostPaise)} checkout est.</strong>
                </div>

                <div className="order-card-actions">
                  {order.status === 'DRAFT' ? (
                    <Link className="secondary-link" to={`/orders/${order.id}/edit`}>Edit draft</Link>
                  ) : null}
                  {canPay ? (
                    <Link className="primary-link" to={`/orders/${order.id}/checkout`}>
                      {order.status === 'DRAFT' ? 'Review & pay' : 'Continue payment'}
                    </Link>
                  ) : null}
                  {postPayment ? (
                    <Link
                      className={order.status === 'OUT_FOR_DELIVERY' ? 'primary-link' : 'secondary-link'}
                      to={`/orders/${order.id}/checkout`}
                    >
                      {postPaymentActionLabel(order.status)}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
