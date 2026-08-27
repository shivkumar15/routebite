import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AccountPage() {
  const { user, partner, logout, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  async function requestOtp() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/auth/email-otp/request');
      setOtpRequested(true);
      setMessage(
        data.data.delivery === 'email'
          ? `Verification code sent to ${user.email}.`
          : 'Development fallback active. Check the backend terminal for the 6-digit email OTP.',
      );
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? 'Could not send a verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.post('/auth/email-otp/verify', { otp });
      await refreshSession();
      setOtp('');
      setOtpRequested(false);
      setMessage('Email verified successfully.');
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? 'Could not verify the code.');
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = user.role === 'ADMIN';
  const isApprovedPartner =
    !isAdmin && partner.exists && partner.verificationStatus === 'APPROVED';

  return (
    <main className="app-shell account-shell">
      <section className="account-card wide-account-card">
        <div className="account-heading">
          <div>
            <p className="eyebrow">Signed in</p>
            <h1>{user.name}</h1>
          </div>
          <Link className="secondary-link" to="/">Home</Link>
        </div>

        <dl className="account-details">
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Email verified</dt><dd>{user.emailVerified ? 'Yes' : 'Not yet'}</dd></div>
          <div><dt>Phone</dt><dd>{user.phone}</dd></div>
          <div><dt>Role</dt><dd>{user.role}</dd></div>
        </dl>

        {!user.emailVerified ? (
          <section className="account-section">
            <h2>Verify your email</h2>
            <p className="form-intro">
              RouteBite sends a 6-digit code to your account email. Email verification is required before a partner application can be approved.
            </p>
            {!otpRequested ? (
              <button className="primary-button" type="button" disabled={busy} onClick={requestOtp}>
                Send verification code
              </button>
            ) : (
              <form className="inline-form" onSubmit={verifyOtp}>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit OTP"
                  pattern="\d{6}"
                  required
                />
                <button className="primary-button" type="submit" disabled={busy}>Verify</button>
                <button className="secondary-button" type="button" disabled={busy} onClick={requestOtp}>Send again</button>
              </form>
            )}
          </section>
        ) : null}

        {!isAdmin ? (
          <section className="account-section">
            <h2>Delivery partner</h2>
            {!partner.exists ? (
              <>
                <p className="form-intro">Apply with a profile photo and campus ID. Vendor/customer screens will never receive your ID document.</p>
                <Link className="primary-link" to="/partner/apply">Apply to become a partner</Link>
              </>
            ) : (
              <>
                <div className="partner-status-row">
                  <span>Verification status</span>
                  <strong>{partner.verificationStatus}</strong>
                </div>
                {isApprovedPartner ? (
                  <div className="partner-account-action">
                    <p className="form-intro">You’re approved. Choose whether you’re available nearby or already heading somewhere.</p>
                    <Link className="primary-link" to="/partner">Open partner workspace</Link>
                  </div>
                ) : null}
              </>
            )}
          </section>
        ) : null}

        {isAdmin ? (
          <section className="account-section">
            <h2>Admin</h2>
            <p className="form-intro">Admin accounts are reserved for RouteBite operations and cannot participate as delivery partners.</p>
            <Link className="primary-link" to="/admin/partners">Review partner applications</Link>
          </section>
        ) : null}

        {message ? <p className="success-message">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <button className="secondary-button" type="button" onClick={handleLogout}>Sign out</button>
      </section>
    </main>
  );
}
