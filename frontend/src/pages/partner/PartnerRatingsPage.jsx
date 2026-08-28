import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function stars(score) {
  return '★'.repeat(Number(score ?? 0)) + '☆'.repeat(Math.max(0, 5 - Number(score ?? 0)));
}

export default function PartnerRatingsPage() {
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [privacy, setPrivacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.get('/partner/ratings')
      .then(({ data }) => {
        if (!active) return;
        setSummary(data.data.summary);
        setReviews(data.data.reviews ?? []);
        setPrivacy(data.data.privacy ?? null);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.error?.message ??
              'Could not load customer reviews.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  if (loading) {
    return <main className="partner-reviews-shell"><p>Loading customer reviews…</p></main>;
  }

  return (
    <main className="partner-reviews-shell">
      <section className="partner-reviews-card">
        <header className="partner-reviews-header">
          <div>
            <p className="eyebrow">RouteBite partner</p>
            <h1>Customer reviews</h1>
            <p>See which completed delivery each rating belongs to and read the feedback customers left for you.</p>
          </div>
          <div className="partner-reviews-nav">
            <Link className="secondary-link" to="/partner">Partner workspace</Link>
            <Link className="secondary-link" to="/partner/earnings">Demo earnings</Link>
          </div>
        </header>

        {error ? <p className="form-error">{error}</p> : null}

        {!error && summary ? (
          <>
            <section className="partner-rating-overview">
              <div>
                <span>Your customer rating</span>
                <strong>
                  {summary.ratingCount > 0
                    ? `${Number(summary.ratingAverage).toFixed(1)} / 5`
                    : 'No ratings yet'}
                </strong>
              </div>
              <div>
                <span>Total ratings</span>
                <strong>{summary.ratingCount}</strong>
              </div>
            </section>

            <div className="partner-review-privacy-note">
              <strong>Customer privacy</strong>
              <p>
                Reviews show the customer&apos;s first name only. Email, phone number and full account identity stay private.
              </p>
              {privacy?.note ? <small>{privacy.note}</small> : null}
            </div>

            {reviews.length === 0 ? (
              <div className="partner-reviews-empty">
                <h2>No customer reviews yet</h2>
                <p>A review appears here after a customer rates one of your completed deliveries.</p>
              </div>
            ) : (
              <div className="partner-review-list">
                {reviews.map((review) => (
                  <article className="partner-review-card" key={review.id}>
                    <div className="partner-review-topline">
                      <div>
                        <strong className="partner-review-stars" aria-label={`${review.score} out of 5 stars`}>
                          {stars(review.score)}
                        </strong>
                        <span>{review.score}/5</span>
                      </div>
                      <time>{formatDate(review.createdAt)}</time>
                    </div>

                    <div className="partner-review-order">
                      <p className="eyebrow">Order #{review.order?.shortId ?? '—'}</p>
                      <h2>{review.order?.vendorDisplayName ?? 'Completed delivery'}</h2>
                      <p>
                        {review.order?.pickupText ?? 'Pickup'} <span>→</span> {review.order?.dropText ?? 'Drop'}
                      </p>
                      <small>Completed {formatDate(review.order?.completedAt)}</small>
                    </div>

                    <blockquote className={`partner-review-feedback ${review.feedback ? '' : 'is-empty'}`}>
                      {review.feedback || 'No written feedback was left for this rating.'}
                    </blockquote>

                    <div className="partner-review-customer">
                      <span>Reviewed by</span>
                      <strong>{review.customerDisplayName}</strong>
                      <small>First name only</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
