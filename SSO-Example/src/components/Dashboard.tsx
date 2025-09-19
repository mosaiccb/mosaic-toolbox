import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { useState } from 'react';
import { loginRequest } from '../auth/authConfig';
import { LogIn, LogOut, User, Building, ArrowLeft } from 'lucide-react';
import { TenantManager } from './TenantManager';

const Dashboard = () => {
  const { instance, accounts } = useMsal();
  const [currentView, setCurrentView] = useState<'dashboard' | 'tenants'>('dashboard');

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(e => {
      console.error(e);
    });
  };

  const handleLogout = () => {
    instance.logoutPopup().catch(e => {
      console.error(e);
    });
  };

  const renderContent = () => {
    if (currentView === 'tenants') {
      return (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={() => setCurrentView('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 15px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
          </div>
          <TenantManager />
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
               <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={20} />
            Tenant Management
          </h3>
          <p>Configure and manage UKG Ready tenant connections for data integration</p>
          <button 
            onClick={() => setCurrentView('tenants')}
            style={{ padding: '8px 16px', backgroundColor: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Manage Tenants
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ marginBottom: '40px', textAlign: 'center' }}>
        <h1>Mosaic Operations Dashboard</h1>
        <p>Secure Access with Microsoft Entra ID (Azure AD)</p>
      </header>

      <AuthenticatedTemplate>
        <div style={{ backgroundColor: '#f0f8ff', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <User size={24} color="#007acc" />
              <div>
                <h3 style={{ margin: 0, color: '#007acc' }}>
                  Welcome, {accounts[0]?.name || 'User'}!
                </h3>
                <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                  {accounts[0]?.username}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 15px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>

        {renderContent()}
      </AuthenticatedTemplate>

      <UnauthenticatedTemplate>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h2>🔐 Authentication Required</h2>
            <p>Please sign in with your Microsoft account to access the Mosaic dashboard.</p>
          </div>
          
          <button
            onClick={handleLogin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px 30px',
              backgroundColor: '#0078d4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            <LogIn size={20} />
            Sign in with Microsoft
          </button>
          
          <div style={{ marginTop: '30px', color: '#faf9f9ff', fontSize: '14px' }}>
            <p>🔒 Your data is protected with enterprise-grade security</p>
            <p>📱 Supports multi-factor authentication</p>
            <p>🌐 Single sign-on across all company applications</p>
          </div>
        </div>
      </UnauthenticatedTemplate>
    </div>
  );
};

export default Dashboard;
