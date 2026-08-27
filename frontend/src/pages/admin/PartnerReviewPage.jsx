import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';

export default function PartnerReviewPage() {
  const [partners, setPartners] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function loadPending() {
    setError('');
    try {
      const { data } = await api.get('/admin/partners/pending');
      setPartners(data.data.partners);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'Could not load pending partner applications.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

  async function handleApprove(partnerId) {
    setBusyId(partnerId);
    setError('');
    try {
      await api.post(`/admin/partners/${partnerId}/approve`);
      setPartners((current) => current.filter((partner) => partner.id !== partnerId));
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ?? 'Could not approve this partner.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(partnerId) {
    const reason = reasons[partnerId]?.trim();
    if (!reason || reason.length < 3) {
      setError('Enter a short rejection reason first.');
      return;
    }

    setBusyId(partnerId);
    setError('');
    try {
      await api.post(`/admin/partners/${partnerId}/reject`, { reason });
      setPartners((current) => current.filter((partner) => partner.id !== partnerId));
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ?? 'Could not reject this partner.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <div className="admin-header">
          <div>
            <p className="eyebrow">RouteBite admin</p>
            <h1>Partner verification queue</h1>
            <p>Review campus identity before allowing a partner to receive delivery offers.</p>
          </div>
          <Link className="secondary-link" to="/account">Account</Link>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {loading ? <p>Loading applications…</p> : null}
        {!loading && partners.length === 0 ? (
          <div className="empty-state">No partner applications are waiting for review.</div>
        ) : null}

        <div className="review-list">
          {partners.map((partner) => (
            <article className="review-card" key={partner.id}>
              <div className="review-grid">
                <div>
                  <h2>{partner.applicant.name}</h2>
                  <p>{partner.applicant.email}</p>
                  <p>{partner.applicant.phone}</p>
                  <p className={partner.applicant.phoneVerified ? 'status-good' : 'status-warning'}>
                    {partner.applicant.phoneVerified ? 'Phone verified' : 'Phone not verified'}
                  </p>
                  <dl className="account-details compact-details">
                    <div><dt>College</dt><dd>{partner.collegeName}</dd></div>
                    <div><dt>Enrollment</dt><dd>{partner.enrollmentNumber}</dd></div>
                  </dl>
                </div>

                <div className="review-images">
                  <figure>
                    <figcaption>Profile photo</figcaption>
                    {partner.reviewAssets.profilePhotoUrl ? (
                      <img src={partner.reviewAssets.profilePhotoUrl} alt="Applicant profile" />
                    ) : <span>Unavailable</span>}
                  </figure>
                  <figure>
                    <figcaption>College ID</figcaption>
                    {partner.reviewAssets.collegeIdUrl ? (
                      <img src={partner.reviewAssets.collegeIdUrl} alt="Applicant college ID" />
                    ) : <span>Unavailable</span>}
                  </figure>
                </div>
              </div>

              <div className="review-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={busyId === partner.id || !partner.applicant.phoneVerified}
                  onClick={() => handleApprove(partner.id)}
                >
                  Approve
                </button>
                <input
                  placeholder="Reason if rejecting"
                  value={reasons[partner.id] ?? ''}
                  onChange={(event) => setReasons({ ...reasons, [partner.id]: event.target.value })}
                />
                <button
                  className="secondary-button danger-button"
                  type="button"
                  disabled={busyId === partner.id}
                  onClick={() => handleReject(partner.id)}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
