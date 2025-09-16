import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FileBrowser from './FileBrowser';
import FileUpload from './FileUpload';
import FileOperations from './FileOperations';
import { useSftpConfigurationsApi } from '../../api/sftpConfigurationsApi';
import type { SftpFile } from '../../api/sftpApi';
import type { SftpConfiguration } from '../../api/sftpConfigurationsApi';

const SftpManager: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getSftpConfiguration } = useSftpConfigurationsApi();

  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFile, setSelectedFile] = useState<SftpFile | undefined>();
  const [configuration, setConfiguration] = useState<SftpConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadConfiguration = useCallback(async (configId: number) => {
    try {
      setLoading(true);
      const config = await getSftpConfiguration(configId);
      setConfiguration(config);
      // Set initial path to the configured remote path if available
      if (config.remotePath) {
        setCurrentPath(config.remotePath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [getSftpConfiguration]);

  // Load configuration on mount
  useEffect(() => {
    const configId = searchParams.get('configId');
    if (configId) {
      loadConfiguration(parseInt(configId));
    } else {
      setError('No configuration specified');
      setLoading(false);
    }
  }, [searchParams, loadConfiguration]);

  const handlePathChange = (newPath: string) => {
    setCurrentPath(newPath);
    setSelectedFile(undefined); // Clear selection when navigating
  };

  const handleFileSelect = (file: SftpFile) => {
    setSelectedFile(file);
  };

  const handleOperationComplete = () => {
    setSuccess('Operation completed successfully');
    setError(null);
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setSuccess(null);
    // Clear error message after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  const handleRefresh = () => {
    // This will trigger a refresh in the FileBrowser component
    setSelectedFile(undefined);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading SFTP configuration...</p>
        </div>
      </div>
    );
  }

  if (error && !configuration) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/sftp/configurations')}
                  className="text-gray-500 hover:text-gray-700 p-2"
                  title="Back to Configurations"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">SFTP File Manager</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 00-1.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/sftp/configurations')}
                className="text-gray-500 hover:text-gray-700 p-2"
                title="Back to Configurations"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">SFTP File Manager</h1>
                {configuration && (
                  <p className="text-sm text-gray-600 mt-1">
                    Connected to: {configuration.name} ({configuration.host}:{configuration.port})
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Status Messages */}
        {(error || success) && (
          <div className="mb-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 00-1.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-green-800">{success}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* File Browser - Takes up 2 columns on large screens */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Browser */}
            {configuration && configuration.id && (
              <FileBrowser
                currentPath={currentPath}
                onPathChange={handlePathChange}
                onFileSelect={handleFileSelect}
                onRefresh={handleRefresh}
                configId={configuration.id}
              />
            )}

            {/* File Upload */}
            {configuration && configuration.id && (
              <FileUpload
                currentPath={currentPath}
                onUploadComplete={handleOperationComplete}
                onUploadError={handleError}
                configId={configuration.id}
              />
            )}
          </div>

          {/* File Operations Sidebar */}
          <div className="lg:col-span-1">
            {configuration && configuration.id && (
              <FileOperations
                selectedFile={selectedFile}
                currentPath={currentPath}
                onOperationComplete={handleOperationComplete}
                onError={handleError}
                configId={configuration.id}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <div className="text-center text-sm text-gray-500">
            <p>SFTP File Manager - Secure file operations with Microsoft Entra ID authentication</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SftpManager;