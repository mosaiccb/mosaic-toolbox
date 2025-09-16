import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SftpConfigurationsTable, SftpConfigurationForm } from './index';
import type { SftpConfiguration } from '../../api/sftpConfigurationsApi';

const SftpConfigurationsManager: React.FC = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingConfiguration, setEditingConfiguration] = useState<SftpConfiguration | null>(null);

  const handleConfigurationSelect = (config: SftpConfiguration) => {
    // Navigate to SFTP manager with the selected configuration
    navigate(`/sftp/manager?configId=${config.id}`);
  };

  const handleConfigurationCreate = () => {
    setEditingConfiguration(null);
    setShowForm(true);
  };

  const handleConfigurationEdit = (config: SftpConfiguration) => {
    setEditingConfiguration(config);
    setShowForm(true);
  };

  const handleFormSave = () => {
    setShowForm(false);
    setEditingConfiguration(null);
    // Refresh the table by triggering a re-render
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingConfiguration(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-500 hover:text-gray-700 p-2"
                title="Back to Dashboard"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">SFTP Configuration Manager</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showForm ? (
          <SftpConfigurationForm
            configuration={editingConfiguration}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        ) : (
          <SftpConfigurationsTable
            onConfigurationSelect={handleConfigurationSelect}
            onConfigurationEdit={handleConfigurationEdit}
            onConfigurationCreate={handleConfigurationCreate}
          />
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <div className="text-center text-sm text-gray-500">
            <p>SFTP Configuration Manager - Manage your SFTP server connections securely</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SftpConfigurationsManager;