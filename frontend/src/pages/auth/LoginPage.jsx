import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ emailOrPhone: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/account" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(form);
      navigate(location.state?.from ?? '/account', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message ?? 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand-link" to="/">RouteBite</Link>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in</h1>
        <p className="form-intro">Order from the local food places you already know.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email or phone
            <input
              autoComplete="username"
              value={form.emailOrPhone}
              onChange={(event) => setForm({ ...form, emailOrPhone: event.target.value })}
              placeholder="you@example.com or +919876543210"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">New to RouteBite? <Link to="/register">Create an account</Link></p>
      </section>
    </main>
  );
}
