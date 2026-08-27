import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function PartnerRoute({ children }) {
  const { user, partner, loading } = useAuth();

  if (loading) {
    return <main className="app-shell"><p>Checking partner access…</p></main>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/account" replace />;
  if (!partner.exists || partner.verificationStatus !== 'APPROVED') {
    return <Navigate to="/account" replace />;
  }

  return children;
}
