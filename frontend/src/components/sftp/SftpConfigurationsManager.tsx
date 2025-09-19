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
    <>
      {/* Header */}
      <div 
        className="bg-gradient-to-r text-white p-6 shadow-lg"
        style={{ 
          background: 'linear-gradient(to right, #3b82f6, #2563eb)',
          borderBottom: '1px solid #1e40af'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-3 rounded-lg transition-all duration-200 border-2 border-white border-opacity-30 hover:border-opacity-50 hover:shadow-lg"
              title="Back to Dashboard"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'translateX(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">SFTP Configuration Manager</h1>
              <p className="text-blue-100 mt-1">Manage your SFTP server connections securely</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
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
      </div>
    </>
  );
};

export default SftpConfigurationsManager;