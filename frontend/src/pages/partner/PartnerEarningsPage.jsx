import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';

function formatMoney(paise) {
  return `₹${(Number(paise ?? 0) / 100).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function PartnerEarningsPage() {
  const [summary, setSummary] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [rating, setRating] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get('/partner/earnings'),
      api.get('/partner/operational-state'),
    ])
      .then(([earningsResponse, partnerResponse]) => {
        if (!active) return;
        setSummary(earningsResponse.data.data.summary);
        setEarnings(earningsResponse.data.data.earnings);
        setNote(earningsResponse.data.data.note);
        const partner = partnerResponse.data.data.partner;
        setRating({
          average: Number(partner.ratingAverage ?? 0),
          count: Number(partner.ratingCount ?? 0),
        });
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.error?.message ??
              'Could not load partner earnings.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  if (loading) {
    return <main className="earnings-shell"><p>Loading earnings…</p></main>;
  }

  return (
    <main className="earnings-shell">
      <section className="earnings-card">
        <header className="earnings-header">
          <div>
            <p className="eyebrow">RouteBite partner</p>
            <h1>Demo earnings</h1>
            <p>One earning record is created only after a delivery completes successfully.</p>
          </div>
          <div className="earnings-header-actions">
            <Link className="secondary-link" to="/partner">Partner workspace</Link>
            <Link className="secondary-link" to="/partner/offers">Delivery offers</Link>
          </div>
        </header>

        {error ? <p className="form-error">{error}</p> : null}

        {!error && rating ? (
          <div className="rating-partner-summary partner-rating-summary">
            <span>Customer rating</span>
            <strong>
              {rating.count > 0
                ? `★ ${rating.average.toFixed(1)} / 5 · ${rating.count} rating${rating.count === 1 ? '' : 's'}`
                : 'No customer ratings yet'}
            </strong>
          </div>
        ) : null}

        {!error && summary ? (
          <>
            <div className="earnings-summary-grid">
              <article>
                <span>Completed earnings</span>
                <strong>{summary.completedEarningCount}</strong>
              </article>
              <article>
                <span>Base earnings</span>
                <strong>{formatMoney(summary.baseEarningPaise)}</strong>
              </article>
              <article>
                <span>Incentives</span>
                <strong>{formatMoney(summary.incentivePaise)}</strong>
              </article>
              <article className="earnings-total-card">
                <span>Total demo earnings</span>
                <strong>{formatMoney(summary.totalEarningPaise)}</strong>
              </article>
            </div>

            <div className="demo-accounting-warning earnings-warning">
              <strong>Prototype accounting only</strong>
              <p>{note}</p>
            </div>

            {earnings.length === 0 ? (
              <div className="earnings-empty-state">
                <h2>No completed earnings yet</h2>
                <p>An earning appears here only after a delivery OTP is verified and the order reaches COMPLETED.</p>
              </div>
            ) : (
              <section className="earnings-list">
                <div className="earnings-list-heading">
                  <div>
                    <p className="eyebrow">History</p>
                    <h2>Completed delivery earnings</h2>
                  </div>
                </div>

                {earnings.map((earning) => (
                  <article className="earning-row" key={earning.id}>
                    <div className="earning-order-copy">
                      <strong>{earning.vendorDisplayName}</strong>
                      <span>{earning.dropLabel || `Order #${earning.orderId.slice(-6).toUpperCase()}`}</span>
                      <small>{formatDate(earning.earnedAt)}</small>
                    </div>
                    <div className="earning-breakdown">
                      <span>Base <strong>{formatMoney(earning.baseEarningPaise)}</strong></span>
                      <span>Incentive <strong>{formatMoney(earning.incentivePaise)}</strong></span>
                      <span>Total <strong>{formatMoney(earning.totalEarningPaise)}</strong></span>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
