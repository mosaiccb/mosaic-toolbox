import React, { useState, useCallback, useEffect } from 'react';
import { useSftpConfigurationsApi, type SftpConfiguration } from '../api/sftpConfigurationsApi';
import { useSftpApi } from '../api/sftpApi';

interface FileTransferItem {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

const FileTransferAgent: React.FC = () => {
  const { getSftpConfigurations } = useSftpConfigurationsApi();
  const { uploadFile } = useSftpApi();
  
  const [configurations, setConfigurations] = useState<SftpConfiguration[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<SftpConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<FileTransferItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Load SFTP configurations on component mount
  useEffect(() => {
    const loadConfigurations = async () => {
      try {
        setLoading(true);
        setError(null);
        const configs = await getSftpConfigurations();
        setConfigurations(configs.filter(config => config.isActive));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configurations');
      } finally {
        setLoading(false);
      }
    };

    loadConfigurations();
  }, [getSftpConfigurations]);

  // Handle drag and drop events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Upload file to SFTP
  const uploadFileToSftp = useCallback(async (transfer: FileTransferItem) => {
    if (!selectedConfig) return;

    try {
      // Update status to uploading
      setTransfers(prev => 
        prev.map(t => t.id === transfer.id ? { ...t, status: 'uploading' } : t)
      );

      // Use remote path from config, or default to root
      const remotePath = selectedConfig.remotePath || '/';
      
      await uploadFile(transfer.file, remotePath, selectedConfig.id!);
      
      // Update status to completed
      setTransfers(prev => 
        prev.map(t => t.id === transfer.id ? { ...t, status: 'completed', progress: 100 } : t)
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setTransfers(prev => 
        prev.map(t => t.id === transfer.id ? { ...t, status: 'error', error: errorMessage } : t)
      );
    }
  }, [selectedConfig, uploadFile]);

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    // Check file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return `File "${file.name}" is too large. Maximum size is 100MB.`;
    }
    
    // Check for empty files
    if (file.size === 0) {
      return `File "${file.name}" is empty.`;
    }
    
    return null;
  }, []);

  // Handle file selection (both drag-drop and browse)
  const handleFiles = useCallback((files: File[]) => {
    if (!selectedConfig) {
      setError('Please select an SFTP configuration first');
      return;
    }

    // Validate files
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
      } else {
        validFiles.push(file);
      }
    }

    // Show validation errors
    if (errors.length > 0) {
      setError(errors.join(' '));
      if (validFiles.length === 0) return;
    } else {
      setError(null);
    }

    const newTransfers: FileTransferItem[] = validFiles.map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      status: 'pending',
      progress: 0,
    }));

    setTransfers(prev => [...prev, ...newTransfers]);
    
    // Start uploads
    newTransfers.forEach(transfer => uploadFileToSftp(transfer));
  }, [selectedConfig, uploadFileToSftp, validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, [handleFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    // Clear input for repeated selections
    e.target.value = '';
  }, [handleFiles]);

  // Clear all transfers
  const clearTransfers = useCallback(() => {
    setTransfers([]);
  }, []);

  // Remove individual transfer
  const removeTransfer = useCallback((id: string) => {
    setTransfers(prev => prev.filter(t => t.id !== id));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading configurations...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">File Transfer Agent</h1>
          <p className="mt-2 text-gray-600">Upload files to your SFTP configurations</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* SFTP Configuration Selection */}
            <div className="mb-6">
              <label htmlFor="sftp-config" className="block text-sm font-medium text-gray-700 mb-2">
                Select SFTP Configuration
              </label>
              <select
                id="sftp-config"
                value={selectedConfig?.id || ''}
                onChange={(e) => {
                  const configId = parseInt(e.target.value);
                  const config = configurations.find(c => c.id === configId) || null;
                  setSelectedConfig(config);
                  setError(null);
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose an SFTP configuration...</option>
                {configurations.map(config => (
                  <option key={config.id} value={config.id}>
                    {config.name} ({config.host}:{config.port})
                  </option>
                ))}
              </select>
              {configurations.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  No active SFTP configurations found. Please create and activate one first.
                </p>
              )}
            </div>

            {/* File Upload Area */}
            {selectedConfig && (
              <div className="mb-6">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ease-in-out ${
                    isDragOver
                      ? 'border-blue-400 bg-blue-50 transform scale-[1.02] shadow-lg'
                      : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div className={`transition-transform duration-200 ${isDragOver ? 'scale-110' : ''}`}>
                    <svg
                      className={`mx-auto h-16 w-16 ${isDragOver ? 'text-blue-500' : 'text-gray-400'} transition-colors duration-200`}
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="mt-6">
                    <label htmlFor="file-upload" className="cursor-pointer group">
                      <span className={`mt-2 block text-lg font-semibold ${isDragOver ? 'text-blue-700' : 'text-gray-900'} transition-colors duration-200`}>
                        {isDragOver ? 'Drop files here!' : 'Drop files here or click to browse'}
                      </span>
                      <span className="mt-2 block text-sm text-gray-500 group-hover:text-blue-600 transition-colors duration-200">
                        Choose files or drag and drop them here
                      </span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        multiple
                        className="sr-only"
                        onChange={handleFileInputChange}
                      />
                    </label>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center text-sm text-gray-600">
                        <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Destination:</span>
                        <span className="ml-2 text-gray-800">{selectedConfig.name}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <svg className="h-4 w-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Path:</span>
                        <span className="ml-2 text-gray-800 font-mono">{selectedConfig.remotePath || '/'}</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 mt-2">
                        <svg className="h-3 w-3 text-gray-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Maximum file size: 100MB • Multiple files supported
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer Queue */}
            {transfers.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Transfer Queue</h3>
                  <button
                    onClick={clearTransfers}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-3">
                  {transfers.map(transfer => (
                    <div
                      key={transfer.id}
                      className={`relative overflow-hidden border rounded-xl transition-all duration-300 ${
                        transfer.status === 'completed' ? 'border-green-200 bg-green-50' :
                        transfer.status === 'error' ? 'border-red-200 bg-red-50' :
                        transfer.status === 'uploading' ? 'border-blue-200 bg-blue-50' :
                        'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            <div className="flex-shrink-0">
                              {transfer.status === 'completed' ? (
                                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                                  <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : transfer.status === 'error' ? (
                                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                                  <svg className="h-6 w-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : transfer.status === 'uploading' ? (
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                                </div>
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                                  <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {transfer.file.name}
                                  </p>
                                  <div className="flex items-center space-x-2 mt-1">
                                    <p className="text-xs text-gray-500">
                                      {(transfer.file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                    <span className="text-xs text-gray-300">•</span>
                                    <p className="text-xs text-gray-500">
                                      {transfer.file.type || 'Unknown type'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <div className="text-right">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      transfer.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      transfer.status === 'error' ? 'bg-red-100 text-red-800' :
                                      transfer.status === 'uploading' ? 'bg-blue-100 text-blue-800' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {transfer.status === 'completed' ? '✓ Completed' :
                                       transfer.status === 'error' ? '✗ Failed' :
                                       transfer.status === 'uploading' ? '↗ Uploading' :
                                       '⏳ Pending'}
                                    </span>
                                    {transfer.status === 'uploading' && (
                                      <div className="mt-1 text-xs text-blue-600 animate-pulse">
                                        Transferring...
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => removeTransfer(transfer.id)}
                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all duration-200"
                                    title="Remove from queue"
                                  >
                                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              {transfer.error && (
                                <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded-lg">
                                  <p className="text-sm text-red-700 font-medium">Error:</p>
                                  <p className="text-xs text-red-600">{transfer.error}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress bar for uploading files */}
                      {transfer.status === 'uploading' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-100">
                          <div className="h-1 bg-blue-500 transition-all duration-500 animate-pulse w-full"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileTransferAgent;