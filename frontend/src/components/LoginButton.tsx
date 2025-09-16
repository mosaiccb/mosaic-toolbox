import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginButton: React.FC = () => {
  const { login, loading } = useAuth();

  return (
    <button
      onClick={login}
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
    >
      {loading ? 'Signing in...' : 'Sign in with Microsoft'}
    </button>
  );
};

export default LoginButton;