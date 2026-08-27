import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/account" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await register(form);
      navigate('/account', { replace: true });
    } catch (requestError) {
      const apiError = requestError.response?.data?.error;
      const detailMessage = apiError?.details?.[0]?.message;
      setError(detailMessage ?? apiError?.message ?? 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  function update(field) {
    return (event) => setForm({ ...form, [field]: event.target.value });
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand-link" to="/">RouteBite</Link>
        <p className="eyebrow">Start local</p>
        <h1>Create your account</h1>
        <p className="form-intro">One account for ordering now and partner features later.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input autoComplete="name" value={form.name} onChange={update('name')} required />
          </label>
          <label>
            Email
            <input type="email" autoComplete="email" value={form.email} onChange={update('email')} required />
          </label>
          <label>
            Phone
            <input
              autoComplete="tel"
              value={form.phone}
              onChange={update('phone')}
              placeholder="+919876543210"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="new-password"
              minLength="8"
              value={form.password}
              onChange={update('password')}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={submitting} type="submit">
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
