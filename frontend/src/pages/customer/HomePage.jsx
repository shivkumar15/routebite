import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState({ loading: true, status: 'checking', database: 'checking' });

  useEffect(() => {
    let active = true;

    api.get('/health')
      .then(({ data }) => {
        if (active) setHealth({ loading: false, status: data.status, database: data.database });
      })
      .catch(() => {
        if (active) setHealth({ loading: false, status: 'unreachable', database: 'unknown' });
      });

    return () => {
      active = false;
    };
  }, []);

  const connected = health.status === 'ok' && health.database === 'connected';

  return (
    <main className="app-shell">
      <section className="phase-zero-card">
        <p className="eyebrow">RouteBite</p>
        <h1>Local food. A route away.</h1>
        <p>Get food from the local places you already know, even when they do not deliver.</p>

        <div className="home-actions">
          {user ? (
            <Link className="primary-link" to="/account">Open account</Link>
          ) : (
            <>
              <Link className="primary-link" to="/register">Create account</Link>
              <Link className="secondary-link" to="/login">Sign in</Link>
            </>
          )}
        </div>

        <p className="system-status">
          {health.loading
            ? 'Checking RouteBite API…'
            : connected
              ? 'API connected · MongoDB Atlas connected'
              : `API status: ${health.status} · Database: ${health.database}`}
        </p>
      </section>
    </main>
  );
}
