import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/auth.service';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, refreshAuth } = useAuth();
  // Note: authentication redirect is handled by ProtectedRoute in App.tsx.

  const handleLogout = async () => {
    await authService.logout();
    refreshAuth();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold text-gray-900">opn-chat</h1>
          <button
            onClick={handleLogout}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 p-6 max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gray-100 flex items-center justify-center">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full" />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{user?.nickname || 'User'}</h2>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="border-b pb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                <p className="text-sm text-gray-900 mt-1">{user?.status || 'No status'}</p>
              </div>

              <div className="border-b pb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Bio</p>
                <p className="text-sm text-gray-900 mt-1">{user?.bio || 'No bio'}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Last seen</p>
                <p className="text-sm text-gray-900 mt-1">
                  {user?.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'Now'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-center text-gray-500 text-sm mb-4">
              Authentication working correctly
            </p>
            <div className="text-center">
              <button
                onClick={() => window.location.href = '/chat'}
                className="bg-gray-900 text-white text-sm font-medium py-2 px-6 hover:bg-gray-800 transition-colors"
              >
                Go to Chat
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
