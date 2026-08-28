import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios.js';
import LiveTrackingCard from '../../components/customer/LiveTrackingCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { socket } from '../../socket/socket.js';

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
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
  return value ? new Date(value).toLocaleString() : '';
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
  const [tracking, setTracking] = useState(null);
  const [revealedOtp, setRevealedOtp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadState = useCallback(async () => {
    const [orderResponse, paymentResponse, matchingResponse, trackingResponse] = await Promise.all([
      api.get(`/orders/${orderId}`),
      api.get(`/orders/${orderId}/payment`),
      api.get(`/orders/${orderId}/matching`),
      api.get(`/orders/${orderId}/tracking`),
    ]);

    setOrder(orderResponse.data.data.order);
    setPayment(paymentResponse.data.data.payment);
    setMatching(matchingResponse.data.data.matching);
    setTracking(trackingResponse.data.data.tracking);
  }, [orderId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [orderResponse, paymentResponse, matchingResponse, trackingResponse] = await Promise.all([
          api.get(`/orders/${orderId}`),
          api.get(`/orders/${orderId}/payment`),
          api.get(`/orders/${orderId}/matching`),
          api.get(`/orders/${orderId}/tracking`),
        ]);
        if (!active) return;
        setOrder(orderResponse.data.data.order);
        setPayment(paymentResponse.data.data.payment);
        setMatching(matchingResponse.data.data.matching);
        setTracking(trackingResponse.data.data.tracking);
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

  useEffect(() => {
    async function refreshForEvent(payload, nextMessage) {
      if (payload?.orderId !== orderId) return;
      try {
        await loadState();
        setMessage(nextMessage);
      } catch {
        // REST remains authoritative; a later refresh will recover canonical state.
      }
    }

    const onOffersDispatched = (payload) =>
      refreshForEvent(payload, `Offer round ${payload.round} sent to ${payload.offerCount} partner${payload.offerCount === 1 ? '' : 's'}.`);
    const onAssigned = (payload) =>
      refreshForEvent(payload, 'A delivery partner accepted your request.');
    const onMatchingFailed = (payload) =>
      refreshForEvent(payload, 'No partner accepted or remained eligible for this request.');
    const onPickupStarted = (payload) =>
      refreshForEvent(payload, 'Your partner started heading to the food place.');
    const onPriceApprovalRequired = (payload) =>
      refreshForEvent(payload, 'The vendor price is higher than estimated. Please approve or reject it.');
    const onPriceResolved = (payload) =>
      refreshForEvent(payload, 'The actual food price has been recorded.');
    const onPickedUp = (payload) =>
      refreshForEvent(payload, 'Your partner confirmed that the food has been picked up.');
    const onDeliveryStarted = (payload) =>
      refreshForEvent(payload, 'Your partner started the delivery. Live location is now active.');
    const onOtpRequired = (payload) => {
      setRevealedOtp(null);
      return refreshForEvent(payload, 'Your partner reached the drop. Generate a delivery OTP after you are ready to receive the food.');
    };
    const onCompleted = (payload) => {
      setRevealedOtp(null);
      return refreshForEvent(payload, 'Delivery confirmed. This RouteBite request is complete.');
    };
    const onPriceTimedOut = (payload) =>
      refreshForEvent(payload, 'Price approval timed out and this order needs review.');
    const onDeliveryLocation = (payload) => {
      if (payload?.orderId !== orderId) return;
      setTracking((current) => ({
        ...(current ?? {}),
        orderId,
        status: payload.status,
        active: true,
        location: payload.location,
      }));
    };
    const onConnected = async () => {
      try {
        await loadState();
      } catch {
        // A later user refresh can recover if reconnect-time REST also fails.
      }
    };

    socket.connect();
    socket.on('matching:offers-dispatched', onOffersDispatched);
    socket.on('order:assigned', onAssigned);
    socket.on('matching:failed', onMatchingFailed);
    socket.on('order:pickup-started', onPickupStarted);
    socket.on('price:approval-required', onPriceApprovalRequired);
    socket.on('price:resolved', onPriceResolved);
    socket.on('order:picked-up', onPickedUp);
    socket.on('order:delivery-started', onDeliveryStarted);
    socket.on('order:delivery-otp-required', onOtpRequired);
    socket.on('order:completed', onCompleted);
    socket.on('delivery:location', onDeliveryLocation);
    socket.on('price:timed-out', onPriceTimedOut);
    socket.on('system:connected', onConnected);

    return () => {
      socket.off('matching:offers-dispatched', onOffersDispatched);
      socket.off('order:assigned', onAssigned);
      socket.off('matching:failed', onMatchingFailed);
      socket.off('order:pickup-started', onPickupStarted);
      socket.off('price:approval-required', onPriceApprovalRequired);
      socket.off('price:resolved', onPriceResolved);
      socket.off('order:picked-up', onPickedUp);
      socket.off('order:delivery-started', onDeliveryStarted);
      socket.off('order:delivery-otp-required', onOtpRequired);
      socket.off('order:completed', onCompleted);
      socket.off('delivery:location', onDeliveryLocation);
      socket.off('price:timed-out', onPriceTimedOut);
      socket.off('system:connected', onConnected);
      socket.disconnect();
    };
  }, [loadState, orderId]);

  async function verifyCheckoutResponse(response) {
    const { data } = await api.post(`/orders/${orderId}/payment/verify`, {
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
    });

    setPayment(data.data.payment);
    setMatching(data.data.matching ?? null);
    await loadState();
    setMessage('Test payment confirmed by RouteBite. Matching and offer dispatch have started.');
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

  async function handlePriceDecision(decision) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(
        `/orders/${orderId}/price-adjustment/${decision === 'APPROVE' ? 'approve' : 'reject'}`,
      );
      setOrder(data.data.order);
      setMessage(
        decision === 'APPROVE'
          ? 'Higher food price approved. Your partner can continue the pickup.'
          : 'Higher food price rejected. The request was cancelled before purchase.',
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not save your price decision.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateDeliveryOtp() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/orders/${orderId}/delivery-otp`);
      setOrder(data.data.order);
      setRevealedOtp(data.data.deliveryOtp);
      setMessage('Fresh delivery OTP generated. Share it only after the food is physically with you.');
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not generate a delivery OTP.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelOrder() {
    const confirmedCancel = window.confirm(
      'Cancel this RouteBite request? Automatic cancellation is only allowed before food pickup.',
    );
    if (!confirmedCancel) return;

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(`/orders/${orderId}/cancel`, {
        reason: 'Customer cancelled from order details.',
      });
      setOrder(data.data.order);
      setMatching(null);
      setTracking(null);
      setRevealedOtp(null);
      setMessage('Request cancelled before food pickup. Demo refund accounting is now available.');
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not cancel this request.',
      );
    } finally {
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
  const adjustment = order.priceAdjustment ?? {};
  const otpState = order.deliveryOtp ?? {};
  const confirmed = payment?.status === 'PAYMENT_CONFIRMED';
  const payable = ['DRAFT', 'AWAITING_PAYMENT'].includes(order.status);
  const canCancel = CANCELLABLE_STATUSES.has(order.status);
  const matchingActive = order.status === 'MATCHING';
  const waitingForHorizon = matchingActive && matching?.status === 'WAITING_FOR_HORIZON';
  const candidatesReady = matchingActive && matching?.status === 'CANDIDATES_READY';
  const noCandidates = order.status === 'MATCHING_FAILED' || (matchingActive && matching?.status === 'NO_CANDIDATES');

  return (
    <main className="order-shell">
      <section className="checkout-card">
        <div className="order-page-heading checkout-heading">
          <div>
            <p className="eyebrow">Razorpay Test Mode</p>
            <h1>Confirm your request</h1>
            <p className="form-intro">
              Review the server-calculated estimate and follow the delivery state here.
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
          {adjustment.actualFoodCostPaise != null ? (
            <div><span>Actual food price</span><strong>{formatMoney(adjustment.actualFoodCostPaise)}</strong></div>
          ) : null}
          <div><span>Delivery</span><strong>{formatMoney(pricing.customerDeliveryChargePaise)}</strong></div>
          <div><span>Platform fee</span><strong>{formatMoney(pricing.platformFeePaise)}</strong></div>
          <div className="checkout-total">
            <span>{pricing.finalCustomerTotalPaise != null ? 'Current demo total' : 'Estimated total'}</span>
            <strong>{formatMoney(pricing.finalCustomerTotalPaise ?? pricing.estimatedCustomerTotalPaise)}</strong>
          </div>
        </section>

        <div className="test-payment-note">
          <strong>Prototype payment</strong>
          <p>This uses Razorpay Test Mode. Price changes update RouteBite's demo accounting only; no live extra charge or refund is moved.</p>
        </div>

        {payment ? (
          <div className="payment-status-row">
            <span>Payment status</span>
            <strong>{payment.status}</strong>
          </div>
        ) : null}

        {confirmed && order.status === 'ASSIGNED' ? (
          <div className="checkout-success-panel">
            <strong>Partner accepted your request</strong>
            <p>Your partner has the job. The next step is to start heading to the food pickup.</p>
          </div>
        ) : null}

        {confirmed && order.status === 'PARTNER_TO_PICKUP' ? (
          <div className="checkout-success-panel">
            <strong>Partner is handling the pickup</strong>
            <p>
              {adjustment.actualFoodCostPaise == null
                ? 'Your partner is heading to the food place and will confirm the actual vendor price before purchase.'
                : adjustment.status === 'AUTO_DECREASED'
                  ? `The actual food price is lower at ${formatMoney(adjustment.actualFoodCostPaise)}. RouteBite adjusted the demo total downward automatically.`
                  : adjustment.status === 'APPROVED'
                    ? 'You approved the higher vendor price. Your partner can now buy and collect the food.'
                    : 'The vendor price matches the estimate. Your partner can buy and collect the food.'}
            </p>
          </div>
        ) : null}

        {confirmed && order.status === 'PRICE_CONFIRMATION_REQUIRED' ? (
          <div className="price-approval-panel">
            <strong>Vendor price increased — your approval is required</strong>
            <p>
              Estimated food price: {formatMoney(pricing.estimatedFoodCostPaise)}<br />
              Actual food price: {formatMoney(adjustment.actualFoodCostPaise)}<br />
              Increase: {formatMoney(adjustment.differencePaise)}
            </p>
            <small>Respond before {formatDate(adjustment.approvalExpiresAt)}. Your partner is told not to buy the food until you approve.</small>
            <div className="price-approval-actions">
              <button className="primary-button" type="button" disabled={busy} onClick={() => handlePriceDecision('APPROVE')}>
                {busy ? 'Saving…' : `Approve ${formatMoney(adjustment.actualFoodCostPaise)}`}
              </button>
              <button className="secondary-button" type="button" disabled={busy} onClick={() => handlePriceDecision('REJECT')}>
                Reject change
              </button>
            </div>
          </div>
        ) : null}

        {confirmed && order.status === 'PICKED_UP' ? (
          <div className="checkout-success-panel">
            <strong>Food picked up</strong>
            <p>Your partner has the food. Live tracking will begin when they press Start delivery.</p>
          </div>
        ) : null}

        {confirmed && order.status === 'OUT_FOR_DELIVERY' ? (
          <>
            <div className="checkout-success-panel">
              <strong>Your food is on the way</strong>
              <p>The partner started delivery. Foreground location updates are shared while the active delivery page remains open.</p>
            </div>
            <LiveTrackingCard tracking={tracking} dropLabel={order.drop.label} />
          </>
        ) : null}

        {confirmed && order.status === 'DELIVERY_OTP_REQUIRED' ? (
          <>
            <div className="price-approval-panel delivery-otp-panel">
              <strong>Partner is at your drop — confirm only after handoff</strong>
              <p>
                Generate a 6-digit delivery OTP and tell it to the partner only after you have physically received the food. RouteBite stores only a hash of the code.
              </p>
              {revealedOtp ? (
                <div className="delivery-otp-code">
                  <span>Your delivery OTP</span>
                  <strong>{revealedOtp.otp}</strong>
                  <small>Expires {formatDate(revealedOtp.expiresAt)}</small>
                </div>
              ) : otpState.generated ? (
                <p>
                  An OTP is already active until {formatDate(otpState.expiresAt)}, but RouteBite cannot reveal it again after refresh. Generate a new code if you no longer have it.
                </p>
              ) : (
                <p>No OTP has been generated yet.</p>
              )}
              <button
                className="primary-button"
                type="button"
                disabled={busy}
                onClick={handleGenerateDeliveryOtp}
              >
                {busy ? 'Generating…' : otpState.generated ? 'Generate a new OTP' : 'Generate delivery OTP'}
              </button>
            </div>
            <LiveTrackingCard tracking={tracking} dropLabel={order.drop.label} />
          </>
        ) : null}

        {confirmed && order.status === 'COMPLETED' ? (
          <div className="checkout-success-panel">
            <strong>Delivery completed</strong>
            <p>The delivery OTP was verified, the partner was released from this order, and RouteBite recorded completion once.</p>
            {order.completedAt ? <small>Completed {formatDate(order.completedAt)}</small> : null}
          </div>
        ) : null}

        {confirmed && order.status === 'CANCELLED' && adjustment.status === 'REJECTED' ? (
          <div className="matching-failed-panel">
            <strong>Price change rejected</strong>
            <p>The request was cancelled before the partner purchased the food.</p>
          </div>
        ) : null}

        {order.status === 'CANCELLED' && adjustment.status !== 'REJECTED' ? (
          <div className="matching-failed-panel">
            <strong>Request cancelled</strong>
            <p>{order.recovery?.reason || 'This request was cancelled before food pickup.'}</p>
            {confirmed ? (
              <Link className="primary-link" to={`/orders/${orderId}/ledger`}>View demo refund</Link>
            ) : null}
          </div>
        ) : null}

        {confirmed && order.status === 'ADMIN_REVIEW_REQUIRED' ? (
          <div className="matching-failed-panel">
            <strong>Order needs review</strong>
            <p>{order.recovery?.reason || 'This order needs operations review before the prototype can resolve its financial outcome.'}</p>
          </div>
        ) : null}

        {confirmed && waitingForHorizon ? (
          <div className="checkout-success-panel">
            <strong>Payment confirmed — matching scheduled</strong>
            <p>
              This is a future delivery, so RouteBite will start live matching around {formatDate(matching.resumeAt)} instead of failing it hours too early.
            </p>
          </div>
        ) : null}

        {confirmed && candidatesReady ? (
          <div className="checkout-success-panel">
            <strong>Offers are live</strong>
            <p>
              RouteBite found {matching.eligibleCandidateCount} eligible candidate{matching.eligibleCandidateCount === 1 ? '' : 's'}. The highest-ranked available batch is being offered for 20 seconds before fallback advances.
            </p>
          </div>
        ) : null}

        {confirmed && matchingActive && !waitingForHorizon && !candidatesReady && !noCandidates ? (
          <div className="checkout-success-panel">
            <strong>Payment confirmed — finding a partner</strong>
            <p>RouteBite is evaluating verified nearby and on-my-way partners against this delivery window.</p>
          </div>
        ) : null}

        {confirmed && noCandidates ? (
          <div className="matching-failed-panel">
            <strong>No eligible partner right now</strong>
            <p>
              Matching and offer fallback completed without a partner who could satisfy this request. The order is explicitly marked MATCHING_FAILED rather than waiting indefinitely.
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

        {canCancel ? (
          <button className="secondary-button checkout-pay-button" type="button" disabled={busy} onClick={handleCancelOrder}>
            {busy ? 'Working…' : 'Cancel request'}
          </button>
        ) : null}

        {!confirmed && !payable ? (
          <p className="form-error">This order is not currently payable.</p>
        ) : null}
      </section>
    </main>
  );
}
