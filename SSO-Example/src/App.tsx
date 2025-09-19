import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { BrowserRouter } from 'react-router-dom';
import { msalConfig } from './auth/authConfig';
import Dashboard from './components/Dashboard';
import './App.css';

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL
msalInstance.initialize().then(() => {
  console.log('MSAL initialized successfully');
  console.log('Client ID:', msalConfig.auth.clientId);
  console.log('Authority:', msalConfig.auth.authority);
  console.log('Redirect URI:', msalConfig.auth.redirectUri);
}).catch((error) => {
  console.error('MSAL initialization failed:', error);
});

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <div className="App">
          <Dashboard />
        </div>
      </BrowserRouter>
    </MsalProvider>
  );
}

export default App;
