import React from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../config/msalConfig';

const LoginButton: React.FC = () => {
  const { instance, inProgress } = useMsal();
  const loading = inProgress !== 'none';

  const handleLogin = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-8 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border-2 border-blue-600 hover:border-blue-700 flex items-center justify-center gap-3 min-w-[250px]"
      style={{ backgroundColor: '#2563eb', borderColor: '#2563eb' }}
    >
      <svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
        <path d="M0 0h10v10H0V0zm11 0h10v10H11V0zM0 11h10v10H0V11zm11 0h10v10H11V11z"/>
      </svg>
      {loading ? 'Signing in...' : 'Sign in with Microsoft'}
    </button>
  );
};

export default LoginButton;