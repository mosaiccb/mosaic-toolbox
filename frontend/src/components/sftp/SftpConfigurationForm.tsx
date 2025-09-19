import React, { useState, useEffect } from 'react';
import { useSftpConfigurationsApi, type SftpConfiguration, type CreateSftpConfigurationRequest, type UpdateSftpConfigurationRequest } from '../../api/sftpConfigurationsApi';
import { usePgpKeysApi, type PgpKey } from '../../api/pgpService';

interface SftpConfigurationFormProps {
  configuration?: SftpConfiguration | null;
  onSave: () => void;
  onCancel: () => void;
}

const SftpConfigurationForm: React.FC<SftpConfigurationFormProps> = ({
  configuration,
  onSave,
  onCancel,
}) => {
  const { createSftpConfiguration, updateSftpConfiguration } = useSftpConfigurationsApi();
  const { listPgpKeys } = usePgpKeysApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    authMethod: 'password', // Default to password for better UX
    password: '', // For password auth
    privateKeyFile: null as File | null, // For key auth
    remotePath: '',
    configurationJson: '',
    isActive: true,
    // PGP Encryption Support
    enablePgpEncryption: false,
    pgpKeyId: '' as string, // Use string for select dropdown, convert to number when submitting
  });

  const [pgpKeys, setPgpKeys] = useState<PgpKey[]>([]);
  const [loadingPgpKeys, setLoadingPgpKeys] = useState(false);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Load PGP keys when component mounts
  useEffect(() => {
    const loadPgpKeys = async () => {
      setLoadingPgpKeys(true);
      try {
        const keys = await listPgpKeys();
        setPgpKeys(keys);
      } catch (err) {
        console.error('Failed to load PGP keys:', err);
      } finally {
        setLoadingPgpKeys(false);
      }
    };

    loadPgpKeys();
  }, [listPgpKeys]);

  useEffect(() => {
    if (configuration) {
      setFormData({
        name: configuration.name || '',
        host: configuration.host || '',
        port: configuration.port || 22,
        username: configuration.username || '',
        authMethod: configuration.authMethod || 'password',
        password: '', // Don't populate password for security
        privateKeyFile: null, // Don't populate file
        remotePath: configuration.remotePath || '',
        configurationJson: configuration.configurationJson || '',
        isActive: configuration.isActive ?? true,
        enablePgpEncryption: configuration.enablePgpEncryption || false,
        pgpKeyId: configuration.pgpKeyId ? configuration.pgpKeyId.toString() : '',
      });
    } else {
      // Reset form for new configuration
      setFormData({
        name: '',
        host: '',
        port: 22,
        username: '',
        authMethod: 'password',
        password: '',
        privateKeyFile: null,
        remotePath: '',
        configurationJson: '',
        isActive: true,
        enablePgpEncryption: false,
        pgpKeyId: '',
      });
    }
    setValidationErrors({});
    setError(null);
  }, [configuration]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Configuration name is required';
    }

    if (!formData.host.trim()) {
      errors.host = 'Host is required';
    } else if (!/^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$|^(\d{1,3}\.){3}\d{1,3}$/.test(formData.host)) {
      errors.host = 'Please enter a valid hostname or IP address';
    }

    if (!formData.port || formData.port < 1 || formData.port > 65535) {
      errors.port = 'Port must be between 1 and 65535';
    }

    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }

    if (!['password', 'privateKey'].includes(formData.authMethod)) {
      errors.authMethod = 'Please select a valid authentication method';
    }

    // Validate based on auth method
    if (formData.authMethod === 'password' && !formData.password.trim()) {
      errors.password = 'Password is required for password authentication';
    }

    if (formData.authMethod === 'privateKey' && !formData.privateKeyFile) {
      errors.privateKeyFile = 'Private key file is required for private key authentication';
    }

    // Validate PGP encryption settings
    if (formData.enablePgpEncryption && !formData.pgpKeyId) {
      errors.pgpKeyId = 'Please select a PGP key when encryption is enabled';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        privateKeyFile: file
      }));

      // Clear validation error for this field
      if (validationErrors.privateKeyFile) {
        setValidationErrors(prev => ({
          ...prev,
          privateKeyFile: ''
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare the request data
      let requestData: CreateSftpConfigurationRequest | UpdateSftpConfigurationRequest;

      if (configuration) {
        // Update existing configuration
        requestData = {
          name: formData.name,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          authMethod: formData.authMethod,
          remotePath: formData.remotePath || undefined,
          configurationJson: formData.configurationJson || undefined,
          isActive: formData.isActive,
          enablePgpEncryption: formData.enablePgpEncryption,
          pgpKeyId: formData.enablePgpEncryption && formData.pgpKeyId ? parseInt(formData.pgpKeyId) : undefined,
        };
      } else {
        // Create new configuration
        requestData = {
          name: formData.name,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          authMethod: formData.authMethod,
          remotePath: formData.remotePath || undefined,
          configurationJson: formData.configurationJson || undefined,
          enablePgpEncryption: formData.enablePgpEncryption,
          pgpKeyId: formData.enablePgpEncryption && formData.pgpKeyId ? parseInt(formData.pgpKeyId) : undefined,
        };

        // Add credentials based on auth method
        if (formData.authMethod === 'password') {
          (requestData as CreateSftpConfigurationRequest).password = formData.password;
        } else if (formData.authMethod === 'privateKey' && formData.privateKeyFile) {
          // Read the private key file content
          const privateKeyContent = await formData.privateKeyFile.text();
          (requestData as CreateSftpConfigurationRequest).privateKey = privateKeyContent;
        }
      }

      if (configuration) {
        await updateSftpConfiguration(configuration.id!, requestData as UpdateSftpConfigurationRequest);
      } else {
        await createSftpConfiguration(requestData as CreateSftpConfigurationRequest);
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            {configuration ? 'Edit SFTP Configuration' : 'Add SFTP Configuration'}
          </h3>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            {/* Configuration Name */}
            <div className="sm:col-span-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Configuration Name *
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                    validationErrors.name ? 'border-red-300' : ''
                  }`}
                  placeholder="e.g., Production Server, Test Environment"
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                )}
              </div>
            </div>

            {/* Host */}
            <div className="sm:col-span-4">
              <label htmlFor="host" className="block text-sm font-medium text-gray-700">
                Host *
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="host"
                  id="host"
                  value={formData.host}
                  onChange={(e) => handleInputChange('host', e.target.value)}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                    validationErrors.host ? 'border-red-300' : ''
                  }`}
                  placeholder="e.g., sftp.example.com or 192.168.1.100"
                />
                {validationErrors.host && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.host}</p>
                )}
              </div>
            </div>

            {/* Port */}
            <div className="sm:col-span-2">
              <label htmlFor="port" className="block text-sm font-medium text-gray-700">
                Port *
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="port"
                  id="port"
                  min="1"
                  max="65535"
                  value={formData.port}
                  onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 22)}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                    validationErrors.port ? 'border-red-300' : ''
                  }`}
                />
                {validationErrors.port && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.port}</p>
                )}
              </div>
            </div>

            {/* Username */}
            <div className="sm:col-span-3">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username *
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                    validationErrors.username ? 'border-red-300' : ''
                  }`}
                  placeholder="SFTP username"
                />
                {validationErrors.username && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.username}</p>
                )}
              </div>
            </div>

            {/* Authentication Method */}
            <div className="sm:col-span-3">
              <label htmlFor="authMethod" className="block text-sm font-medium text-gray-700">
                Authentication Method *
              </label>
              <div className="mt-1">
                <select
                  name="authMethod"
                  id="authMethod"
                  value={formData.authMethod}
                  onChange={(e) => handleInputChange('authMethod', e.target.value)}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                    validationErrors.authMethod ? 'border-red-300' : ''
                  }`}
                >
                  <option value="password">Password</option>
                  <option value="privateKey">Private Key</option>
                </select>
                {validationErrors.authMethod && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.authMethod}</p>
                )}
              </div>
            </div>

            {/* Password Field - Only show for password auth */}
            {formData.authMethod === 'password' && (
              <div className="sm:col-span-6">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    name="password"
                    id="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                      validationErrors.password ? 'border-red-300' : ''
                    }`}
                    placeholder="Enter SFTP password"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Password will be securely stored in Azure Key Vault
                  </p>
                  {validationErrors.password && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
                  )}
                </div>
              </div>
            )}

            {/* Private Key File Field - Only show for private key auth */}
            {formData.authMethod === 'privateKey' && (
              <div className="sm:col-span-6">
                <label htmlFor="privateKeyFile" className="block text-sm font-medium text-gray-700">
                  Private Key File *
                </label>
                <div className="mt-1">
                  <input
                    type="file"
                    name="privateKeyFile"
                    id="privateKeyFile"
                    accept=".pem,.key,.ppk"
                    onChange={(e) => handleFileChange(e)}
                    className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                      validationErrors.privateKeyFile ? 'border-red-300' : ''
                    }`}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Upload your SSH private key file (.pem, .key, or .ppk). Will be securely stored in Azure Key Vault.
                  </p>
                  {validationErrors.privateKeyFile && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.privateKeyFile}</p>
                  )}
                </div>
              </div>
            )}

            {/* Remote Path */}
            <div className="sm:col-span-6">
              <label htmlFor="remotePath" className="block text-sm font-medium text-gray-700">
                Default Remote Path
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="remotePath"
                  id="remotePath"
                  value={formData.remotePath}
                  onChange={(e) => handleInputChange('remotePath', e.target.value)}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="e.g., /home/user/uploads or /var/www"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Optional default directory to navigate to when connecting (leave empty for root)
                </p>
              </div>
            </div>

            {/* PGP Encryption Section */}
            <div className="sm:col-span-6">
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h4 className="text-base font-medium text-gray-900 mb-4">🔒 PGP Encryption (Optional)</h4>
                
                {/* Enable PGP Encryption */}
                <div className="flex items-center mb-4">
                  <input
                    id="enablePgpEncryption"
                    name="enablePgpEncryption"
                    type="checkbox"
                    checked={formData.enablePgpEncryption}
                    onChange={(e) => handleInputChange('enablePgpEncryption', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="enablePgpEncryption" className="ml-2 block text-sm text-gray-900">
                    Enable PGP encryption for uploaded files
                  </label>
                </div>

                {/* PGP Key Selection */}
                {formData.enablePgpEncryption && (
                  <div className="mt-4">
                    <label htmlFor="pgpKeyId" className="block text-sm font-medium text-gray-700">
                      PGP Public Key *
                    </label>
                    <div className="mt-1">
                      <select
                        name="pgpKeyId"
                        id="pgpKeyId"
                        value={formData.pgpKeyId}
                        onChange={(e) => handleInputChange('pgpKeyId', e.target.value)}
                        disabled={loadingPgpKeys}
                        className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                          validationErrors.pgpKeyId ? 'border-red-300' : ''
                        }`}
                      >
                        <option value="">
                          {loadingPgpKeys ? 'Loading PGP keys...' : 'Select a PGP key'}
                        </option>
                        {pgpKeys.map(key => (
                          <option key={key.id} value={key.id?.toString() || ''}>
                            {key.name} {key.description ? `(${key.description})` : ''}
                          </option>
                        ))}
                      </select>
                      {loadingPgpKeys && (
                        <p className="mt-1 text-sm text-gray-500">Loading available PGP keys...</p>
                      )}
                      {!loadingPgpKeys && pgpKeys.length === 0 && (
                        <p className="mt-1 text-sm text-yellow-600">
                          No PGP keys available. You can create one in the PGP Keys section.
                        </p>
                      )}
                      {validationErrors.pgpKeyId && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.pgpKeyId}</p>
                      )}
                    </div>
                  </div>
                )}

                {formData.enablePgpEncryption && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700">
                      📋 When PGP encryption is enabled, all files uploaded via this SFTP configuration will be automatically encrypted using the selected PGP public key before being transferred.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Configuration JSON */}
            <div className="sm:col-span-6">
              <label htmlFor="configurationJson" className="block text-sm font-medium text-gray-700">
                Additional Configuration (JSON)
              </label>
              <div className="mt-1">
                <textarea
                  name="configurationJson"
                  id="configurationJson"
                  rows={4}
                  value={formData.configurationJson}
                  onChange={(e) => handleInputChange('configurationJson', e.target.value)}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder='{"timeout": 30000, "keepaliveInterval": 10000}'
                />
                <p className="mt-1 text-sm text-gray-500">
                  Optional JSON configuration for advanced SFTP settings
                </p>
              </div>
            </div>

            {/* Active Status */}
            {configuration && (
              <div className="sm:col-span-6">
                <div className="flex items-center">
                  <input
                    id="isActive"
                    name="isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Configuration is active
                  </label>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Inactive configurations cannot be used for SFTP connections
                </p>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              style={{
                backgroundColor: loading ? '#94a3b8' : '#3b82f6',
                borderColor: loading ? '#94a3b8' : '#3b82f6'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.borderColor = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                configuration ? 'Update Configuration' : 'Create Configuration'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SftpConfigurationForm;