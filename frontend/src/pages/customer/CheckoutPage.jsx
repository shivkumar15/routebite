import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function formatMoney(paise) {
  return `₹${(Number(paise) / 100).toFixed(2)}`;
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay Checkout.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout.'));
    document.body.appendChild(script);
  });
}

function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return `pay_${window.crypto.randomUUID()}`;
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function CheckoutPage() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [matching, setMatching] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadState = useCallback(async () => {
    const [orderResponse, paymentResponse, matchingResponse] = await Promise.all([
      api.get(`/orders/${orderId}`),
      api.get(`/orders/${orderId}/payment`),
      api.get(`/orders/${orderId}/matching`),
    ]);

    setOrder(orderResponse.data.data.order);
    setPayment(paymentResponse.data.data.payment);
    setMatching(matchingResponse.data.data.matching);
  }, [orderId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [orderResponse, paymentResponse, matchingResponse] = await Promise.all([
          api.get(`/orders/${orderId}`),
          api.get(`/orders/${orderId}/payment`),
          api.get(`/orders/${orderId}/matching`),
        ]);
        if (!active) return;
        setOrder(orderResponse.data.data.order);
        setPayment(paymentResponse.data.data.payment);
        setMatching(matchingResponse.data.data.matching);
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.error?.message ?? 'Could not load checkout.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [orderId]);

  async function verifyCheckoutResponse(response) {
    const { data } = await api.post(`/orders/${orderId}/payment/verify`, {
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
    });

    setPayment(data.data.payment);
    setMatching(data.data.matching ?? null);
    await loadState();
    setMessage('Test payment confirmed by RouteBite. Matching has started automatically.');
  }

  async function handlePay() {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.post(
        `/orders/${orderId}/payment`,
        {},
        { headers: { 'Idempotency-Key': newIdempotencyKey() } },
      );

      setPayment(data.data.payment);

      if (data.data.payment?.status === 'PAYMENT_CONFIRMED') {
        await loadState();
        setMessage('This test payment is already confirmed.');
        return;
      }

      if (!data.data.checkout) {
        throw new Error('Checkout information is unavailable for this payment attempt.');
      }

      await loadRazorpayCheckout();

      const options = {
        key: data.data.checkout.keyId,
        amount: data.data.checkout.amountPaise,
        currency: data.data.checkout.currency,
        order_id: data.data.checkout.providerOrderId,
        name: data.data.checkout.name,
        description: data.data.checkout.description,
        prefill: {
          name: user?.name ?? '',
          email: user?.email ?? '',
          contact: user?.phone ?? '',
        },
        theme: {
          color: '#E95A3D',
        },
        handler: async (response) => {
          setBusy(true);
          setError('');
          try {
            await verifyCheckoutResponse(response);
          } catch (verificationError) {
            setError(
              verificationError.response?.data?.error?.message ??
                'Checkout returned success, but RouteBite could not verify the payment.',
            );
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setMessage('Test checkout closed. You can retry this payment attempt safely.');
            setBusy(false);
          },
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.on('payment.failed', (response) => {
        setError(
          response.error?.description ??
            'The Razorpay test payment did not complete. Your request has not been sent to partners.',
        );
        setBusy(false);
      });
      checkout.open();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          requestError.message ??
          'Could not start test checkout.',
      );
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="order-shell"><p>Loading checkout…</p></main>;
  }

  if (!order) {
    return (
      <main className="order-shell">
        <section className="orders-card">
          <p className="form-error">{error || 'Order not found.'}</p>
          <Link className="secondary-link" to="/orders">Back to requests</Link>
        </section>
      </main>
    );
  }

  const pricing = order.pricing;
  const confirmed = payment?.status === 'PAYMENT_CONFIRMED';
  const payable = ['DRAFT', 'AWAITING_PAYMENT'].includes(order.status);
  const candidatesReady = matching?.status === 'CANDIDATES_READY';
  const noCandidates = order.status === 'MATCHING_FAILED' || matching?.status === 'NO_CANDIDATES';

  return (
    <main className="order-shell">
      <section className="checkout-card">
        <div className="order-page-heading checkout-heading">
          <div>
            <p className="eyebrow">Razorpay Test Mode</p>
            <h1>Confirm your request</h1>
            <p className="form-intro">
              Review the server-calculated estimate before opening the test checkout.
            </p>
          </div>
          <Link className="secondary-link" to="/orders">My requests</Link>
        </div>

        <section className="checkout-request-summary">
          <span className="order-status-chip">{order.status}</span>
          <h2>{order.vendorDisplayName}</h2>
          <p>{order.requestedItems}</p>
          <div className="checkout-route-row">
            <span><strong>Pickup</strong>{order.pickup.label}</span>
            <span>→</span>
            <span><strong>Drop</strong>{order.drop.label}</span>
          </div>
        </section>

        <section className="checkout-breakdown">
          <div><span>Food estimate</span><strong>{formatMoney(pricing.estimatedFoodCostPaise)}</strong></div>
          <div><span>Delivery</span><strong>{formatMoney(pricing.customerDeliveryChargePaise)}</strong></div>
          <div><span>Platform fee</span><strong>{formatMoney(pricing.platformFeePaise)}</strong></div>
          <div className="checkout-total"><span>Estimated total</span><strong>{formatMoney(pricing.estimatedCustomerTotalPaise)}</strong></div>
        </section>

        <div className="test-payment-note">
          <strong>Prototype payment</strong>
          <p>This uses Razorpay Test Mode. No real RouteBite marketplace settlement or partner payout happens in this phase.</p>
        </div>

        {payment ? (
          <div className="payment-status-row">
            <span>Payment status</span>
            <strong>{payment.status}</strong>
          </div>
        ) : null}

        {confirmed && candidatesReady ? (
          <div className="checkout-success-panel">
            <strong>Eligible partners found</strong>
            <p>
              RouteBite found {matching.eligibleCandidateCount} eligible candidate{matching.eligibleCandidateCount === 1 ? '' : 's'} and prepared the top {matching.offerReadyPartnerIds.length} for offer dispatch. Phase 7 will add accept/reject and atomic assignment.
            </p>
          </div>
        ) : null}

        {confirmed && !candidatesReady && !noCandidates ? (
          <div className="checkout-success-panel">
            <strong>Payment confirmed — finding a partner</strong>
            <p>RouteBite is evaluating verified nearby and on-my-way partners against this delivery window.</p>
          </div>
        ) : null}

        {confirmed && noCandidates ? (
          <div className="matching-failed-panel">
            <strong>No eligible partner right now</strong>
            <p>
              The matching attempt completed without a partner who could satisfy the current route and delivery window. The order is explicitly marked MATCHING_FAILED rather than waiting indefinitely.
            </p>
          </div>
        ) : null}

        {matching?.routeSource === 'DEV_APPROXIMATION' ? (
          <p className="prototype-note">
            Development routing fallback is active. Add GOOGLE_MAPS_API_KEY to the backend to use Google road routes and ETA.
          </p>
        ) : null}

        {message ? <p className="success-message">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        {!confirmed && payable ? (
          <button className="primary-button checkout-pay-button" type="button" disabled={busy} onClick={handlePay}>
            {busy ? 'Preparing test checkout…' : `Pay & Find Partner · ${formatMoney(pricing.estimatedCustomerTotalPaise)}`}
          </button>
        ) : null}

        {!confirmed && !payable ? (
          <p className="form-error">This order is not currently payable.</p>
        ) : null}
      </section>
    </main>
  );
}
