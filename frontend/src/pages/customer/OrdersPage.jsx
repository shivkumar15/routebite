import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';

const CANCELLABLE_STATUSES = new Set([
  'DRAFT',
  'AWAITING_PAYMENT',
  'MATCHING',
  'ASSIGNED',
  'PARTNER_TO_PICKUP',
  'PRICE_CONFIRMATION_REQUIRED',
]);

function formatMoney(paise) {
  return `₹${(Number(paise) / 100).toFixed(2)}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function postPaymentActionLabel(status) {
  if (status === 'DELIVERY_OTP_REQUIRED') return 'Confirm delivery';
  if (status === 'OUT_FOR_DELIVERY') return 'Track delivery';
  if (status === 'MATCHING') return 'Matching details';
  return 'View order';
}

function ledgerActionLabel(status) {
  if (['MATCHING_FAILED', 'CANCELLED'].includes(status)) return 'View demo refund';
  if (status === 'ADMIN_REVIEW_REQUIRED') return 'View review accounting';
  return 'View demo ledger';
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState('');
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

  async function cancelOrder(order) {
    const confirmed = window.confirm(
      'Cancel this RouteBite request? Automatic cancellation is only allowed before food pickup.',
    );
    if (!confirmed) return;

    setBusyOrderId(order.id);
    setError('');
    try {
      const { data } = await api.post(`/orders/${order.id}/cancel`, {
        reason: 'Customer cancelled from My Requests.',
      });
      setOrders((current) => current.map((item) => (
        item.id === order.id
          ? {
              ...item,
              status: data.data.order.status,
              recovery: data.data.order.recovery,
            }
          : item
      )));
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not cancel this request.',
      );
    } finally {
      setBusyOrderId('');
    }
  }

  return (
    <main className="order-shell">
      <section className="orders-card">
        <div className="order-page-heading">
          <div>
            <p className="eyebrow">Your RouteBite requests</p>
            <h1>Food requests</h1>
            <p className="form-intro">Follow each request from Razorpay Test Mode payment through delivery, cancellation, recovery and demo accounting.</p>
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
            const needsImmediateAction = ['OUT_FOR_DELIVERY', 'DELIVERY_OTP_REQUIRED'].includes(order.status);
            const hasDemoLedger = ['COMPLETED', 'MATCHING_FAILED', 'CANCELLED', 'ADMIN_REVIEW_REQUIRED'].includes(order.status);
            const canCancel = CANCELLABLE_STATUSES.has(order.status);
            const hasRecovery = order.recovery?.event && order.recovery.event !== 'NONE';

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

                {hasRecovery ? (
                  <p className="partner-mode-note">
                    Recovery: {order.recovery.reason || order.recovery.event.replaceAll('_', ' ')}
                  </p>
                ) : null}

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
                      className={needsImmediateAction ? 'primary-link' : 'secondary-link'}
                      to={`/orders/${order.id}/checkout`}
                    >
                      {postPaymentActionLabel(order.status)}
                    </Link>
                  ) : null}
                  {canCancel ? (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busyOrderId === order.id}
                      onClick={() => cancelOrder(order)}
                    >
                      {busyOrderId === order.id ? 'Cancelling…' : 'Cancel request'}
                    </button>
                  ) : null}
                  {hasDemoLedger ? (
                    <Link className="primary-link" to={`/orders/${order.id}/ledger`}>
                      {ledgerActionLabel(order.status)}
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
