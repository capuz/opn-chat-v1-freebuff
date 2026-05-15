import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { authService } from './services/auth.service';
import { I18nProvider } from './i18n/I18nContext';
import type { JSX } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import GoogleCallbackPage from './pages/GoogleCallbackPage';
import './index.css';

// authService.isAuthenticated() reads localStorage directly — avoids the one-render
// lag that occurs when context state hasn't committed yet after navigate().
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Cargando...</p></div>;
  if (!authService.isAuthenticated()) return <Navigate to="/login" replace />;
  return children;
};

// SECURITY NOTE: AdminRoute is a UI-only hint. It relies on isAdmin stored in
// localStorage (decoded from JWT at login) which can be modified via DevTools.
// Real admin enforcement is server-side: all /api/admin/* routes require
// get_current_admin dependency which validates the JWT claim on every request.
const AdminRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Cargando...</p></div>;
  if (!authService.isAuthenticated()) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/chat" replace />;
  return children;
};

function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="*" element={<Navigate to="/chat" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </I18nProvider>
  );
}

export default App;
