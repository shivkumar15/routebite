import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';
import { socket } from '../../socket/socket.js';

function formatMoney(paise) {
  return `₹${(Number(paise) / 100).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    timeStyle: 'short',
  }).format(new Date(value));
}

function remainingSeconds(expiresAt, now) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}

function detourText(offer) {
  if (offer.additionalDetourSeconds == null) return 'Dedicated nearby delivery';
  const minutes = Math.ceil(offer.additionalDetourSeconds / 60);
  const km = ((offer.additionalDetourMeters ?? 0) / 1000).toFixed(1);
  return `+${minutes} min · +${km} km detour`;
}

export default function PartnerOffersPage() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  async function loadOffers({ quiet = false } = {}) {
    try {
      const { data } = await api.get('/partner/offers');
      setOffers(data.data.offers);
      if (!quiet) setError('');
    } catch (requestError) {
      if (!quiet) {
        setError(
          requestError.response?.data?.error?.message ??
            'Could not load delivery offers.',
        );
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    loadOffers();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);

    const handleOfferNew = () => {
      setMessage('A new delivery offer arrived.');
      loadOffers({ quiet: true });
    };
    const handleOfferChange = () => loadOffers({ quiet: true });

    socket.connect();
    socket.on('offer:new', handleOfferNew);
    socket.on('offer:expired', handleOfferChange);
    socket.on('offer:cancelled', handleOfferChange);
    socket.on('offer:accepted', handleOfferChange);

    return () => {
      window.clearInterval(clock);
      socket.off('offer:new', handleOfferNew);
      socket.off('offer:expired', handleOfferChange);
      socket.off('offer:cancelled', handleOfferChange);
      socket.off('offer:accepted', handleOfferChange);
    };
  }, []);

  useEffect(() => {
    if (offers.some((offer) => remainingSeconds(offer.expiresAt, now) === 0)) {
      const timer = window.setTimeout(() => loadOffers({ quiet: true }), 600);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [now, offers]);

  async function respond(offerId, action) {
    setBusy(`${action}:${offerId}`);
    setError('');
    setMessage('');

    try {
      const { data } = await api.post(`/partner/offers/${offerId}/${action}`);
      if (action === 'accept') {
        setMessage(`You got the request. Order is now ${data.data.order.status}.`);
      } else {
        setMessage('Offer rejected. RouteBite can continue to the next candidate batch.');
      }
      await loadOffers({ quiet: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          `Could not ${action} this offer.`,
      );
      await loadOffers({ quiet: true });
    } finally {
      setBusy('');
    }
  }

  const orderedOffers = useMemo(
    () => [...offers].sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt)),
    [offers],
  );

  if (loading) {
    return <main className="offer-workspace"><p>Loading delivery offers…</p></main>;
  }

  return (
    <main className="offer-workspace">
      <header className="offer-page-header">
        <div>
          <p className="eyebrow">RouteBite partner</p>
          <h1>Delivery offers</h1>
          <p>Offers are short-lived. Accept only when you can actually complete the pickup and delivery.</p>
        </div>
        <div className="offer-page-actions">
          <Link className="secondary-link" to="/partner">Partner workspace</Link>
          <Link className="secondary-link" to="/account">Account</Link>
        </div>
      </header>

      {message ? <p className="success-message offer-flash">{message}</p> : null}
      {error ? <p className="form-error offer-flash">{error}</p> : null}

      {orderedOffers.length === 0 ? (
        <section className="offer-empty-state">
          <span className="offer-pulse" aria-hidden="true" />
          <h2>No active offer right now</h2>
          <p>Stay available nearby or keep your compatible On My Way trip active. New offers will appear here in real time.</p>
        </section>
      ) : (
        <section className="offer-list">
          {orderedOffers.map((offer) => {
            const seconds = remainingSeconds(offer.expiresAt, now);
            return (
              <article className="delivery-offer-card" key={offer.id}>
                <div className="offer-card-topline">
                  <span className="offer-mode-chip">{offer.partnerMode.replaceAll('_', ' ')}</span>
                  <strong className={seconds <= 5 ? 'offer-countdown urgent' : 'offer-countdown'}>
                    {seconds}s left
                  </strong>
                </div>

                <h2>{offer.request.vendorDisplayName}</h2>
                <p className="offer-items">{offer.request.requestedItems}</p>

                <div className="offer-route-grid">
                  <div>
                    <span>Pickup</span>
                    <strong>{offer.request.pickupLabel}</strong>
                    <small>ETA {formatDate(offer.predictedPickupAt)}</small>
                  </div>
                  <span className="offer-route-arrow">→</span>
                  <div>
                    <span>Drop</span>
                    <strong>{offer.request.dropLabel}</strong>
                    <small>ETA {formatDate(offer.predictedDeliveryAt)}</small>
                  </div>
                </div>

                <div className="offer-economics-row">
                  <div>
                    <span>Expected earning</span>
                    <strong>{formatMoney(offer.expectedEarningPaise)}</strong>
                  </div>
                  <div>
                    <span>Route impact</span>
                    <strong>{detourText(offer)}</strong>
                  </div>
                </div>

                <div className="offer-response-actions">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={Boolean(busy) || seconds === 0}
                    onClick={() => respond(offer.id, 'accept')}
                  >
                    {busy === `accept:${offer.id}` ? 'Accepting…' : 'Accept request'}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={Boolean(busy) || seconds === 0}
                    onClick={() => respond(offer.id, 'reject')}
                  >
                    {busy === `reject:${offer.id}` ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
