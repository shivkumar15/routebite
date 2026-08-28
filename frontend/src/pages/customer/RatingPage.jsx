import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios.js';

const STAR_VALUES = [1, 2, 3, 4, 5];

function ratingLabel(score) {
  if (score === 5) return 'Excellent';
  if (score === 4) return 'Good';
  if (score === 3) return 'Okay';
  if (score === 2) return 'Could be better';
  if (score === 1) return 'Poor';
  return 'Choose a rating';
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function RatingPage() {
  const { orderId } = useParams();
  const [payload, setPayload] = useState(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    api.get(`/orders/${orderId}/rating`)
      .then(({ data }) => {
        if (!active) return;
        setPayload(data.data);
        if (data.data.rating) {
          setScore(data.data.rating.score);
          setFeedback(data.data.rating.feedback ?? '');
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.error?.message ??
              'Could not load rating details for this delivery.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [orderId]);

  const submitted = Boolean(payload?.rating);
  const partnerAverage = useMemo(() => {
    if (!payload?.partner?.ratingCount) return 'New partner rating';
    return `${Number(payload.partner.ratingAverage).toFixed(1)} / 5 from ${payload.partner.ratingCount} rating${payload.partner.ratingCount === 1 ? '' : 's'}`;
  }, [payload]);

  async function submitRating(event) {
    event.preventDefault();
    if (!score) {
      setError('Choose a rating from 1 to 5 stars.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/orders/${orderId}/rating`, {
        score,
        feedback,
      });
      setPayload({
        canRate: false,
        rating: data.data.rating,
        partner: data.data.partner,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not submit your rating.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="rating-shell"><div className="rating-card">Loading rating…</div></main>;
  }

  return (
    <main className="rating-shell">
      <section className="rating-card">
        <div className="rating-heading">
          <div>
            <p className="eyebrow">Completed RouteBite delivery</p>
            <h1>{submitted ? 'Your partner rating' : 'How was your delivery partner?'}</h1>
            <p className="rating-intro">
              {submitted
                ? 'This rating is saved for the completed delivery and cannot be submitted twice.'
                : 'Rate the delivery experience from 1 to 5. Written feedback is optional.'}
            </p>
          </div>
          <div className="rating-nav">
            <Link className="secondary-link" to="/orders">My requests</Link>
            <Link className="secondary-link" to={`/orders/${orderId}/checkout`}>View order</Link>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {!error && payload ? (
          <>
            <div className="rating-partner-summary">
              <span>Partner rating now</span>
              <strong>{partnerAverage}</strong>
            </div>

            <form className="rating-form" onSubmit={submitRating}>
              <div className="rating-star-panel">
                <span className="rating-question">Your score</span>
                <div className="rating-stars" role="radiogroup" aria-label="Partner rating">
                  {STAR_VALUES.map((value) => (
                    <button
                      key={value}
                      className={`rating-star ${value <= score ? 'is-selected' : ''}`}
                      type="button"
                      role="radio"
                      aria-checked={score === value}
                      aria-label={`${value} star${value === 1 ? '' : 's'}`}
                      disabled={submitted || busy}
                      onClick={() => setScore(value)}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <strong className="rating-score-label">
                  {score ? `${score}/5 · ${ratingLabel(score)}` : ratingLabel(score)}
                </strong>
              </div>

              <label className="rating-feedback-field">
                Optional feedback
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value.slice(0, 500))}
                  placeholder="What went well, or what could be improved?"
                  rows={5}
                  maxLength={500}
                  disabled={submitted || busy}
                />
                <span>{feedback.length}/500</span>
              </label>

              {submitted ? (
                <div className="rating-submitted-note">
                  <strong>Rating submitted</strong>
                  <span>{formatDate(payload.rating.createdAt)}</span>
                </div>
              ) : (
                <button className="primary-button rating-submit" type="submit" disabled={busy || !score}>
                  {busy ? 'Submitting…' : 'Submit partner rating'}
                </button>
              )}
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}
