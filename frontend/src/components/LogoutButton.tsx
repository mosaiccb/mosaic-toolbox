import React from 'react';
import { useMsal } from '@azure/msal-react';
import { msalConfig } from '../config/msalConfig';

const LogoutButton: React.FC = () => {
  const { instance, accounts, inProgress } = useMsal();
  const user = accounts[0];
  const loading = inProgress !== 'none';

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri,
    });
  };

  if (!user) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
        >
          {(user.name || user.username || 'U').charAt(0).toUpperCase()}
        </div>
        <span className="text-gray-700 font-medium">
          {user.name || user.username}
        </span>
      </div>
      <button
        onClick={handleLogout}
        disabled={loading}
        className="text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
        style={{
          backgroundColor: loading ? '#fca5a5' : '#ef4444',
          borderColor: loading ? '#fca5a5' : '#ef4444'
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = '#dc2626';
            e.currentTarget.style.borderColor = '#dc2626';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.backgroundColor = '#ef4444';
            e.currentTarget.style.borderColor = '#ef4444';
          }
        }}
      >
        {loading ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  );
};

export default LogoutButton;