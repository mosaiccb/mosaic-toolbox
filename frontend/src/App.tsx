import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { msalConfig } from './config/msalConfig';
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import { SftpManager } from './components/sftp'
import SftpConfigurationsManager from './components/sftp/SftpConfigurationsManager'
import PasswordManager from './components/passwords/PasswordManager'
import FileTransferAgent from './components/FileTransferAgent'
import PgpKeysManager from './components/pgp/PgpKeysManager'
import SharePointConfigurationManager from './components/sharepoint/SharePointConfigurationManager'
import './App.css'

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
      <Router>
        <div className="App font-sans">
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sftp" element={<SftpConfigurationsManager />} />
                <Route path="/sftp/manager" element={<SftpManager />} />
                <Route path="/sharepoint" element={<SharePointConfigurationManager />} />
                <Route path="/passwords" element={<PasswordManager />} />
                <Route path="/file-transfer" element={<FileTransferAgent />} />
                <Route path="/pgp-keys" element={<PgpKeysManager />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        </div>
      </Router>
    </MsalProvider>
  )
}

export default App
