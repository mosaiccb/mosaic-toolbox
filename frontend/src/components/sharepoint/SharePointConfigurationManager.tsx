import React, { useState, useEffect, useCallback } from 'react';
import { useSharePointApi, type SharePointConfiguration } from '../../api/sharePointService';
import SharePointFileBrowser from './SharePointFileBrowser';

const SharePointConfigurationManager: React.FC = () => {
  const [configurations, setConfigurations] = useState<SharePointConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<SharePointConfiguration | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [configToBrowse, setConfigToBrowse] = useState<SharePointConfiguration | null>(null);

  const { 
    getSharePointConfigurations, 
    deleteSharePointConfiguration, 
    createSharePointConfiguration,
    updateSharePointConfiguration 
  } = useSharePointApi();

  const loadConfigurations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSharePointConfigurations();
      setConfigurations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SharePoint configurations');
      console.error('Error loading SharePoint configurations:', err);
    } finally {
      setLoading(false);
    }
  }, [getSharePointConfigurations]);

  useEffect(() => {
    loadConfigurations();
  }, [loadConfigurations]);

  const handleDeleteConfiguration = async () => {
    if (!selectedConfig) return;

    try {
      await deleteSharePointConfiguration(selectedConfig.id);
      await loadConfigurations();
      setShowDeleteDialog(false);
      setSelectedConfig(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete configuration');
      console.error('Error deleting configuration:', err);
    }
  };

  const handleCreateConfiguration = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const configData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || '',
      tenantDomain: formData.get('tenantDomain') as string,
      clientId: formData.get('clientId') as string,
      clientSecret: formData.get('clientSecret') as string,
      isActive: formData.get('isActive') === 'on',
    };

    try {
      await createSharePointConfiguration(configData);
      setShowCreateDialog(false);
      await loadConfigurations(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create configuration');
      console.error('Error creating configuration:', err);
    }
  };

  const handleEditConfiguration = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedConfig) return;

    const formData = new FormData(e.currentTarget);
    const updateData: Partial<SharePointConfiguration> & { clientSecret?: string } = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || '',
      tenantDomain: formData.get('tenantDomain') as string,
      clientId: formData.get('clientId') as string,
      isActive: formData.get('isActive') === 'on',
    };

    // Only include clientSecret if it was provided
    const clientSecret = formData.get('clientSecret') as string;
    if (clientSecret && clientSecret.trim() !== '') {
      updateData.clientSecret = clientSecret;
    }

    try {
      await updateSharePointConfiguration(selectedConfig.id, updateData);
      setShowEditDialog(false);
      setSelectedConfig(null);
      await loadConfigurations(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update configuration');
      console.error('Error updating configuration:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">SharePoint Configurations</h1>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <span className="text-lg">+</span>
          Add Configuration
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <span className="h-5 w-5 text-red-400 font-bold">⚠</span>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {configurations.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400 text-4xl">⚙</div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No SharePoint configurations</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new SharePoint configuration.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors"
            >
              <span className="text-lg">+</span>
              Add Configuration
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {configurations.map((config) => (
            <div key={config.id} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{config.name}</h3>
                  {config.description && (
                    <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setSelectedConfig(config);
                      setShowEditDialog(true);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Edit configuration"
                  >
                    <span className="text-sm">✏</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedConfig(config);
                      setShowDeleteDialog(true);
                    }}
                    className="text-gray-400 hover:text-red-600"
                    title="Delete configuration"
                  >
                    <span className="text-sm">🗑</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tenant Domain:</span>
                  <span className="text-gray-900 font-medium">{config.tenantDomain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Client ID:</span>
                  <span className="text-gray-900 font-mono text-xs">{config.clientId.substring(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    config.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {config.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span className="text-gray-900">{formatDate(config.createdAt)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setConfigToBrowse(config);
                    setShowFileBrowser(true);
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="text-sm">📁</span>
                  Browse Files
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && selectedConfig && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <span className="text-red-600 text-2xl">⚠</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4">Delete Configuration</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete the SharePoint configuration "{selectedConfig.name}"? 
                  This action cannot be undone and will also remove all associated sites, libraries, and transfer jobs.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handleDeleteConfiguration}
                  className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  Delete Configuration
                </button>
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setSelectedConfig(null);
                  }}
                  className="mt-3 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Configuration Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create SharePoint Configuration</h3>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <span className="text-xl">×</span>
                </button>
              </div>
              
              <form onSubmit={handleCreateConfiguration} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Configuration Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="My SharePoint Config"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional description for this configuration"
                  />
                </div>

                <div>
                  <label htmlFor="tenantDomain" className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant Domain *
                  </label>
                  <input
                    type="text"
                    id="tenantDomain"
                    name="tenantDomain"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="contoso.sharepoint.com"
                  />
                </div>

                <div>
                  <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID (Application ID) *
                  </label>
                  <input
                    type="text"
                    id="clientId"
                    name="clientId"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="12345678-1234-1234-1234-123456789012"
                  />
                </div>

                <div>
                  <label htmlFor="clientSecret" className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret *
                  </label>
                  <input
                    type="password"
                    id="clientSecret"
                    name="clientSecret"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter client secret"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    name="isActive"
                    defaultChecked={true}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Active configuration
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Create Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Configuration Dialog */}
      {showEditDialog && selectedConfig && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit SharePoint Configuration</h3>
                <button
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedConfig(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <span className="text-xl">×</span>
                </button>
              </div>
              
              <form onSubmit={handleEditConfiguration} className="space-y-4">
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Configuration Name *
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    name="name"
                    required
                    defaultValue={selectedConfig.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    name="description"
                    rows={3}
                    defaultValue={selectedConfig.description || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-tenantDomain" className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant Domain *
                  </label>
                  <input
                    type="text"
                    id="edit-tenantDomain"
                    name="tenantDomain"
                    required
                    defaultValue={selectedConfig.tenantDomain}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-clientId" className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID (Application ID) *
                  </label>
                  <input
                    type="text"
                    id="edit-clientId"
                    name="clientId"
                    required
                    defaultValue={selectedConfig.clientId}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="edit-clientSecret" className="block text-sm font-medium text-gray-700 mb-1">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    id="edit-clientSecret"
                    name="clientSecret"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Leave blank to keep current secret"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank to keep the current client secret unchanged
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit-isActive"
                    name="isActive"
                    defaultChecked={selectedConfig.isActive}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="edit-isActive" className="ml-2 block text-sm text-gray-900">
                    Active configuration
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditDialog(false);
                      setSelectedConfig(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-800 text-sm font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Update Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* File Browser */}
      {showFileBrowser && configToBrowse && (
        <SharePointFileBrowser
          configuration={configToBrowse}
          onClose={() => {
            setShowFileBrowser(false);
            setConfigToBrowse(null);
          }}
        />
      )}
    </div>
  );
};

export default SharePointConfigurationManager;