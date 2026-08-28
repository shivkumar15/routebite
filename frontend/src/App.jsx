import { Route, Routes } from 'react-router-dom';
import AdminOrderDetailPage from './pages/admin/AdminOrderDetailPage.jsx';
import AdminOrdersPage from './pages/admin/AdminOrdersPage.jsx';
import PartnerReviewPage from './pages/admin/PartnerReviewPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import AccountPage from './pages/customer/AccountPage.jsx';
import CheckoutPage from './pages/customer/CheckoutPage.jsx';
import DemoLedgerPage from './pages/customer/DemoLedgerPage.jsx';
import HomePage from './pages/customer/HomePage.jsx';
import OrderDraftPage from './pages/customer/OrderDraftPage.jsx';
import OrdersPage from './pages/customer/OrdersPage.jsx';
import PartnerApplyPage from './pages/partner/PartnerApplyPage.jsx';
import PartnerDashboardPage from './pages/partner/PartnerDashboardPage.jsx';
import PartnerEarningsPage from './pages/partner/PartnerEarningsPage.jsx';
import PartnerOffersPage from './pages/partner/PartnerOffersPage.jsx';
import AdminRoute from './routes/AdminRoute.jsx';
import PartnerRoute from './routes/PartnerRoute.jsx';
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
        path="/orders"
        element={
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/new"
        element={
          <ProtectedRoute>
            <OrderDraftPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:orderId/edit"
        element={
          <ProtectedRoute>
            <OrderDraftPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:orderId/checkout"
        element={
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:orderId/ledger"
        element={
          <ProtectedRoute>
            <DemoLedgerPage />
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
        path="/partner"
        element={
          <PartnerRoute>
            <PartnerDashboardPage />
          </PartnerRoute>
        }
      />
      <Route
        path="/partner/offers"
        element={
          <PartnerRoute>
            <PartnerOffersPage />
          </PartnerRoute>
        }
      />
      <Route
        path="/partner/earnings"
        element={
          <PartnerRoute>
            <PartnerEarningsPage />
          </PartnerRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <AdminRoute>
            <AdminOrdersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/orders/:orderId"
        element={
          <AdminRoute>
            <AdminOrderDetailPage />
          </AdminRoute>
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
