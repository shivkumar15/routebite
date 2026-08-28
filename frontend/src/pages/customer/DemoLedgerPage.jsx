import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios.js';

function formatMoney(paise) {
  return `₹${(Number(paise ?? 0) / 100).toFixed(2)}`;
}

function formatSignedMoney(paise) {
  const value = Number(paise ?? 0);
  if (value === 0) return formatMoney(0);
  return `${value > 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`;
}

function humanize(value) {
  return value?.replaceAll('_', ' ') ?? '—';
}

export default function DemoLedgerPage() {
  const { orderId } = useParams();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.get(`/orders/${orderId}/demo-ledger`)
      .then(({ data }) => {
        if (active) setLedger(data.data.ledger);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.error?.message ??
              'Could not load the demo financial breakdown.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [orderId]);

  if (loading) {
    return <main className="ledger-shell"><p>Loading demo ledger…</p></main>;
  }

  if (!ledger) {
    return (
      <main className="ledger-shell">
        <section className="ledger-card">
          <p className="form-error">{error || 'Demo ledger unavailable.'}</p>
          <Link className="secondary-link" to="/orders">Back to requests</Link>
        </section>
      </main>
    );
  }

  const completed = ledger.outcome === 'COMPLETED';
  const matchingFailed = ledger.outcome === 'MATCHING_FAILED';

  return (
    <main className="ledger-shell">
      <section className="ledger-card">
        <header className="ledger-header">
          <div>
            <p className="eyebrow">RouteBite demo accounting</p>
            <h1>Financial breakdown</h1>
            <p>Order #{String(orderId).slice(-6).toUpperCase()}</p>
          </div>
          <div className="ledger-header-actions">
            <Link className="secondary-link" to={`/orders/${orderId}/checkout`}>View order</Link>
            <Link className="secondary-link" to="/orders">My requests</Link>
          </div>
        </header>

        <div className="demo-accounting-warning">
          <strong>Prototype ledger only</strong>
          <p>{ledger.note}</p>
        </div>

        <div className="ledger-status-row">
          <span>Order outcome</span>
          <strong>{humanize(ledger.outcome)}</strong>
        </div>

        <section className="ledger-section">
          <div className="ledger-section-heading">
            <div>
              <p className="eyebrow">Customer side</p>
              <h2>Test payment & adjustment</h2>
            </div>
            <span className="ledger-provider-chip">
              {ledger.providerPayment.provider ?? 'No provider'} · {ledger.providerPayment.mode ?? '—'}
            </span>
          </div>

          <div className="ledger-grid">
            <div><span>Razorpay test payment</span><strong>{formatMoney(ledger.customer.testPaymentPaise)}</strong></div>
            <div><span>Estimated total</span><strong>{formatMoney(ledger.customer.estimatedTotalPaise)}</strong></div>
            <div><span>Current demo total</span><strong>{formatMoney(ledger.customer.currentDemoTotalPaise)}</strong></div>
            <div><span>Demo adjustment</span><strong>{formatSignedMoney(ledger.customer.adjustmentPaise)}</strong></div>
            <div><span>Demo refund represented</span><strong>{formatMoney(ledger.customer.demoRefundPaise)}</strong></div>
            <div><span>Demo extra charge represented</span><strong>{formatMoney(ledger.customer.demoAdditionalChargePaise)}</strong></div>
          </div>
        </section>

        {matchingFailed ? (
          <section className="ledger-refund-panel">
            <p className="eyebrow">Matching failure</p>
            <h2>Full demo refund represented</h2>
            <strong>{formatMoney(ledger.refund.amountPaise)}</strong>
            <p>{ledger.refund.reason}</p>
            <small>{humanize(ledger.refund.status)} · no live provider refund was issued by this prototype flow.</small>
          </section>
        ) : null}

        <section className="ledger-section">
          <div className="ledger-section-heading">
            <div>
              <p className="eyebrow">Fulfilment economics</p>
              <h2>Where the demo amount goes</h2>
            </div>
          </div>

          <div className="ledger-grid ledger-economics-grid">
            <div><span>Food reimbursement</span><strong>{formatMoney(ledger.food.reimbursementPaise)}</strong></div>
            <div><span>Partner base earning</span><strong>{formatMoney(ledger.partner.baseEarningPaise)}</strong></div>
            <div><span>Partner incentive</span><strong>{formatMoney(ledger.partner.incentivePaise)}</strong></div>
            <div><span>Partner total earning</span><strong>{formatMoney(ledger.partner.totalEarningPaise)}</strong></div>
            <div><span>Platform fee</span><strong>{formatMoney(ledger.platform.feePaise)}</strong></div>
            <div><span>Platform subsidy</span><strong>{formatMoney(ledger.platform.subsidyPaise)}</strong></div>
          </div>

          {completed ? (
            <p className="ledger-footnote">
              Partner incentive and platform subsidy are intentionally separate. In the current prototype flow the incentive can be ₹0.00; when incentives are introduced, the subsidy line shows the platform-funded amount instead of hiding it inside partner earnings.
            </p>
          ) : null}
        </section>

        <div className="ledger-settlement-row">
          <span>Settlement representation</span>
          <strong>{humanize(ledger.settlement.status)}</strong>
        </div>
      </section>
    </main>
  );
}
