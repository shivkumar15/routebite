import { useEffect, useState } from 'react';
import api from '../../api/axios.js';
import { socket } from '../../socket/socket.js';

function formatMoney(paise) {
  return `₹${(Number(paise) / 100).toFixed(2)}`;
}

function rupeesToPaise(value) {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
}

export default function ActiveDeliveryCard({ order: initialOrder, onOrderChange, onCompleted }) {
  const [order, setOrder] = useState(initialOrder);
  const [actualPrice, setActualPrice] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [deliveryOtp, setDeliveryOtp] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function applyOrder(nextOrder) {
    setOrder(nextOrder);
    onOrderChange?.(nextOrder);
  }

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    setActualPrice(
      order?.priceAdjustment?.actualFoodCostPaise != null
        ? (order.priceAdjustment.actualFoodCostPaise / 100).toFixed(2)
        : '',
    );
    setReceiptFile(null);
  }, [order?.id, order?.priceAdjustment?.actualFoodCostPaise]);

  useEffect(() => {
    if (!order) return undefined;

    async function refreshActiveOrder(payload) {
      if (payload?.orderId !== order.id) return;
      try {
        const { data } = await api.get('/partner/active-order');
        if (!data.data.order) {
          onCompleted?.({ id: order.id, status: payload.status ?? 'COMPLETED' });
          return;
        }
        applyOrder(data.data.order);
        if (payload.status === 'PARTNER_TO_PICKUP') {
          setMessage('Customer approved the higher food price.');
        }
        if (payload.expiresAt) {
          setMessage('Customer generated a delivery OTP. Ask them for the 6-digit code after handoff.');
        }
      } catch {
        // REST remains authoritative; a later dashboard refresh can recover.
      }
    }

    socket.on('price:approved', refreshActiveOrder);
    socket.on('price:rejected', refreshActiveOrder);
    socket.on('price:timed-out', refreshActiveOrder);
    socket.on('delivery:otp-generated', refreshActiveOrder);
    socket.on('order:completed', refreshActiveOrder);

    return () => {
      socket.off('price:approved', refreshActiveOrder);
      socket.off('price:rejected', refreshActiveOrder);
      socket.off('price:timed-out', refreshActiveOrder);
      socket.off('delivery:otp-generated', refreshActiveOrder);
      socket.off('order:completed', refreshActiveOrder);
    };
  }, [order, onOrderChange, onCompleted]);

  if (!order) return null;

  async function runAction(path, successMessage) {
    setBusy(path);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post(path);
      applyOrder(data.data.order);
      setMessage(successMessage);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not update this delivery.',
      );
    } finally {
      setBusy('');
    }
  }

  async function reportPrice(event) {
    event.preventDefault();
    const actualFoodCostPaise = rupeesToPaise(actualPrice);
    if (actualFoodCostPaise == null) {
      setError('Enter the actual food amount in rupees with up to two decimal places.');
      return;
    }

    setBusy('price');
    setError('');
    setMessage('');

    try {
      let receiptAssetId = null;
      if (receiptFile) {
        const formData = new FormData();
        formData.append('purpose', 'ORDER_RECEIPT');
        formData.append('file', receiptFile);
        const uploadResponse = await api.post('/uploads', formData);
        receiptAssetId = uploadResponse.data.data.asset.id;
      }

      const { data } = await api.post('/partner/active-order/actual-price', {
        actualFoodCostPaise,
        receiptAssetId,
      });
      applyOrder(data.data.order);
      setMessage(
        data.data.order.status === 'PRICE_CONFIRMATION_REQUIRED'
          ? 'Higher price sent to the customer for approval.'
          : 'Actual food price recorded. You can confirm pickup after buying the food.',
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not record the actual food price.',
      );
    } finally {
      setBusy('');
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(deliveryOtp)) {
      setError('Enter the 6-digit OTP shown to the customer.');
      return;
    }

    setBusy('delivery-otp');
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/partner/active-order/verify-delivery-otp', {
        otp: deliveryOtp,
      });
      setDeliveryOtp('');
      onCompleted?.(data.data.completedOrder);
    } catch (requestError) {
      const details = requestError.response?.data?.error?.details;
      const suffix = Number.isInteger(details?.attemptsRemaining)
        ? ` ${details.attemptsRemaining} attempt${details.attemptsRemaining === 1 ? '' : 's'} remaining for this code.`
        : '';
      setError(
        `${requestError.response?.data?.error?.message ?? 'Could not verify the delivery OTP.'}${suffix}`,
      );
    } finally {
      setBusy('');
    }
  }

  const adjustment = order.priceAdjustment ?? {};
  const priceReported = adjustment.actualFoodCostPaise != null;
  const otpState = order.deliveryOtp ?? {};

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
          <span>Food estimate <strong>{formatMoney(order.estimatedFoodCostPaise)}</strong></span>
          <span>Order #{order.id.slice(-6).toUpperCase()}</span>
        </div>
      </div>

      {message ? <p className="success-message active-delivery-flash">{message}</p> : null}
      {error ? <p className="form-error active-delivery-flash">{error}</p> : null}

      {order.status === 'ASSIGNED' ? (
        <div className="active-delivery-next-step">
          <strong>Ready to head to the food place?</strong>
          <p>Start pickup only when you are beginning this accepted delivery. This is separate from your planned On My Way routes.</p>
          <button
            className="primary-button"
            type="button"
            disabled={Boolean(busy)}
            onClick={() => runAction('/partner/active-order/start-pickup', 'Pickup journey started.')}
          >
            {busy ? 'Starting…' : 'Start pickup'}
          </button>
        </div>
      ) : null}

      {order.status === 'PARTNER_TO_PICKUP' && !priceReported ? (
        <form className="active-delivery-price-form" onSubmit={reportPrice}>
          <div>
            <strong>At the vendor: confirm the actual food amount</strong>
            <p>RouteBite compares this with the customer estimate before you buy the food.</p>
          </div>
          <label>
            Actual food price (₹)
            <input
              inputMode="decimal"
              value={actualPrice}
              onChange={(event) => setActualPrice(event.target.value)}
              placeholder={(order.estimatedFoodCostPaise / 100).toFixed(2)}
              required
            />
          </label>
          <label>
            Receipt / price proof (optional)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="primary-button" type="submit" disabled={Boolean(busy)}>
            {busy === 'price' ? 'Saving price…' : 'Confirm actual price'}
          </button>
        </form>
      ) : null}

      {order.status === 'PRICE_CONFIRMATION_REQUIRED' ? (
        <div className="active-delivery-waiting">
          <strong>Waiting for customer approval</strong>
          <p>
            Actual food price is {formatMoney(adjustment.actualFoodCostPaise)} — {formatMoney(adjustment.differencePaise)} above the estimate. Do not buy the food until the customer approves.
          </p>
          <small>Approval expires {new Date(adjustment.approvalExpiresAt).toLocaleString()}.</small>
        </div>
      ) : null}

      {order.status === 'PARTNER_TO_PICKUP' && priceReported ? (
        <div className="active-delivery-next-step">
          <strong>
            {adjustment.status === 'AUTO_DECREASED'
              ? 'Lower price recorded automatically'
              : adjustment.status === 'APPROVED'
                ? 'Customer approved the higher price'
                : 'Price confirmed'}
          </strong>
          <p>
            Actual food price: {formatMoney(adjustment.actualFoodCostPaise)}. Buy the food, then confirm only after it is physically with you.
          </p>
          <button
            className="primary-button"
            type="button"
            disabled={Boolean(busy)}
            onClick={() => runAction('/partner/active-order/confirm-pickup', 'Food pickup confirmed.')}
          >
            {busy ? 'Confirming…' : 'Confirm food picked up'}
          </button>
        </div>
      ) : null}

      {order.status === 'PICKED_UP' ? (
        <div className="active-delivery-next-step">
          <strong>Food picked up</strong>
          <p>Start delivery when you are leaving the food place. Foreground GPS sharing begins only after this action.</p>
          <button
            className="primary-button"
            type="button"
            disabled={Boolean(busy)}
            onClick={() => runAction('/partner/active-order/start-delivery', 'Live delivery started. Keep this page open for tracking.')}
          >
            {busy ? 'Starting delivery…' : 'Start delivery'}
          </button>
        </div>
      ) : null}

      {order.status === 'OUT_FOR_DELIVERY' ? (
        <div className="active-delivery-next-step live-tracking-partner-panel">
          <strong>Live delivery tracking is active</strong>
          <p>Keep this page open while travelling. When you are physically at the customer drop, request delivery confirmation.</p>
          <button
            className="primary-button"
            type="button"
            disabled={Boolean(busy)}
            onClick={() => runAction('/partner/active-order/request-delivery-otp', 'Delivery confirmation requested. Ask the customer to generate their OTP.')}
          >
            {busy ? 'Requesting…' : 'I reached the customer · Request OTP'}
          </button>
        </div>
      ) : null}

      {order.status === 'DELIVERY_OTP_REQUIRED' ? (
        <form className="active-delivery-price-form" onSubmit={verifyOtp}>
          <div>
            <strong>Confirm handoff with the customer OTP</strong>
            <p>
              {otpState.generated
                ? `A customer OTP is active until ${new Date(otpState.expiresAt).toLocaleTimeString()}. Ask for it only after the customer has the food.`
                : 'Waiting for the customer to generate a 6-digit delivery OTP on their order page.'}
            </p>
          </div>
          <label>
            Customer delivery OTP
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={deliveryOtp}
              onChange={(event) => setDeliveryOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit OTP"
              disabled={!otpState.generated || Boolean(busy)}
              required
            />
          </label>
          <small>
            {otpState.attempts ?? 0} of {otpState.maxAttempts ?? 5} incorrect attempts used for the current code.
          </small>
          <button
            className="primary-button"
            type="submit"
            disabled={!otpState.generated || Boolean(busy) || deliveryOtp.length !== 6}
          >
            {busy === 'delivery-otp' ? 'Verifying…' : 'Verify OTP & complete delivery'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
