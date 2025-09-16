import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const LogoutButton: React.FC = () => {
  const { logout, user, loading } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-4">
      <span className="text-gray-700">
        Welcome, {user.name || user.username}
      </span>
      <button
        onClick={logout}
        disabled={loading}
        className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
      >
        {loading ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  );
};

export default LogoutButton;