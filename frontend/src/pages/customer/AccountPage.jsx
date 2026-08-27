import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <main className="app-shell">
      <section className="account-card">
        <p className="eyebrow">Signed in</p>
        <h1>{user.name}</h1>
        <dl className="account-details">
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Phone</dt><dd>{user.phone}</dd></div>
          <div><dt>Phone verified</dt><dd>{user.phoneVerified ? 'Yes' : 'Not yet'}</dd></div>
          <div><dt>Role</dt><dd>{user.role}</dd></div>
        </dl>
        <button className="secondary-button" type="button" onClick={handleLogout}>Sign out</button>
      </section>
    </main>
  );
}
