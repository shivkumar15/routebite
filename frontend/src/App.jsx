import { useEffect, useState } from 'react';
import api from './api/axios.js';

export default function App() {
  const [health, setHealth] = useState({
    loading: true,
    status: 'checking',
    database: 'checking',
  });

  useEffect(() => {
    let active = true;

    async function checkHealth() {
      try {
        const { data } = await api.get('/health');

        if (active) {
          setHealth({
            loading: false,
            status: data.status,
            database: data.database,
          });
        }
      } catch {
        if (active) {
          setHealth({
            loading: false,
            status: 'unreachable',
            database: 'unknown',
          });
        }
      }
    }

    checkHealth();

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
        <p>
          Phase 0 scaffold is ready. Product screens will be implemented from the
          locked UI design system instead of a generic template.
        </p>

        <p>
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
