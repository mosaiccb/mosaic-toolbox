import React from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutButton from './LogoutButton';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleSftpClick = () => {
    navigate('/sftp');
  };
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Mosaic Toolbox</h1>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Welcome to Mosaic Toolbox
              </h2>
              <p className="text-gray-600 mb-6">
                Your UKG Ready tenant management and integration platform
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Tenant Management</h3>
                  <p className="text-gray-600">Manage your UKG Ready tenants and configurations</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">API Integration</h3>
                  <p className="text-gray-600">Configure and monitor third-party API integrations</p>
                </div>

                <div
                  className="bg-white p-6 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={handleSftpClick}
                >
                  <h3 className="text-lg font-medium text-gray-900 mb-2">SFTP Configuration</h3>
                  <p className="text-gray-600">Manage SFTP server configurations and file transfers</p>
                  <div className="mt-4 text-blue-600 text-sm font-medium">
                    Manage Configurations →
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;