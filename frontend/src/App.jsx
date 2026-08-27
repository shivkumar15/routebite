import { Route, Routes } from 'react-router-dom';
import PartnerReviewPage from './pages/admin/PartnerReviewPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import AccountPage from './pages/customer/AccountPage.jsx';
import HomePage from './pages/customer/HomePage.jsx';
import PartnerApplyPage from './pages/partner/PartnerApplyPage.jsx';
import AdminRoute from './routes/AdminRoute.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/partner/apply"
        element={
          <ProtectedRoute>
            <PartnerApplyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/partners"
        element={
          <AdminRoute>
            <PartnerReviewPage />
          </AdminRoute>
        }
      />
    </Routes>
  );
}
