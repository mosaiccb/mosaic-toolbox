import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleSftpClick = () => {
    navigate('/sftp');
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Welcome to Mosaic Toolbox
          </h2>
          <p className="text-gray-600 mb-6">
            Your UKG Ready tenant management and integration platform
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {/* Tenant Management Card */}
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-3">
                    <svg className="w-8 h-8 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">Tenant Management</h3>
                  </div>
                  <p className="text-gray-600">Manage your UKG Ready tenants and configurations</p>
                </div>

                {/* API Integration Card */}
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center mb-3">
                    <svg className="w-8 h-8 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">API Integration</h3>
                  </div>
                  <p className="text-gray-600">Configure and monitor third-party API integrations</p>
                </div>

                {/* SFTP Configuration Card */}
                <div
                  className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={handleSftpClick}
                >
                  <div className="flex items-center mb-3">
                    <svg className="w-8 h-8 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">SFTP Configuration</h3>
                  </div>
                  <p className="text-gray-600">Manage SFTP server configurations and file transfers</p>
                  <div className="mt-4 text-blue-600 text-sm font-medium">
                    Manage Configurations →
                  </div>
                </div>

                {/* SharePoint Configuration Card */}
                <div
                  className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/sharepoint')}
                >
                  <div className="flex items-center mb-3">
                    <svg className="w-8 h-8 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m8 5 3 3 6-3" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">SharePoint Integration</h3>
                  </div>
                  <p className="text-gray-600">Configure SharePoint connections and manage document transfers</p>
                  <div className="mt-4 text-blue-600 text-sm font-medium">
                    Manage SharePoint →
                  </div>
                </div>

                {/* PGP Keys Card */}
                <div
                  className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/pgp-keys')}
                >
                  <div className="flex items-center mb-3">
                    <svg className="w-8 h-8 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">PGP Keys</h3>
                  </div>
                  <p className="text-gray-600">Manage PGP encryption keys for secure file transfers</p>
                  <div className="mt-4 text-blue-600 text-sm font-medium">
                    Manage Keys →
                  </div>
                </div>

                {/* Password Manager Card */}
                <div
                  className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/passwords')}
                >
                  <div className="flex items-center mb-3">
                    <svg className="w-8 h-8 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">Password Manager</h3>
                  </div>
                  <p className="text-gray-600">Securely store and manage application passwords</p>
                  <div className="mt-4 text-blue-600 text-sm font-medium">
                    Manage Passwords →
                  </div>
                </div>

                {/* File Transfer Agent Card */}
                <div
                  className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate('/file-transfer')}
                >
                  <div className="flex items-center mb-3">
                    <svg className="w-8 h-8 text-indigo-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">File Transfer Agent</h3>
                  </div>
                  <p className="text-gray-600">Monitor and manage automated file transfer processes</p>
                  <div className="mt-4 text-blue-600 text-sm font-medium">
                    View Transfers →
                  </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;