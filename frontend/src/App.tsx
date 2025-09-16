import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './components/Dashboard'
import { SftpManager } from './components/sftp'
import SftpConfigurationsManager from './components/sftp/SftpConfigurationsManager'
import './App.css'

function App() {
  return (
    <Router>
      <div className="App">
        <ProtectedRoute>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sftp" element={<SftpConfigurationsManager />} />
            <Route path="/sftp/manager" element={<SftpManager />} />
          </Routes>
        </ProtectedRoute>
      </div>
    </Router>
  )
}

export default App
