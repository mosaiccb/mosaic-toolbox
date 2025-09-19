import React, { useState, useEffect, useCallback } from 'react';
import { usePgpKeysApi, type PgpKey, type CreatePgpKeyRequest, type UpdatePgpKeyRequest } from '../../api/pgpService';
import PgpKeysTable from './PgpKeysTable';
import PgpKeyForm from './PgpKeyForm';

const PgpKeysManager: React.FC = () => {
  const [pgpKeys, setPgpKeys] = useState<PgpKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<PgpKey | null>(null);

  const {
    listPgpKeys,
    createPgpKey,
    updatePgpKey,
    deletePgpKey,
  } = usePgpKeysApi();

  const loadPgpKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const keys = await listPgpKeys();
      setPgpKeys(keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PGP keys');
    } finally {
      setLoading(false);
    }
  }, [listPgpKeys]);

  useEffect(() => {
    loadPgpKeys();
  }, [loadPgpKeys]);

  const handleCreateKey = () => {
    setEditingKey(null);
    setShowForm(true);
  };

  const handleEditKey = (key: PgpKey) => {
    setEditingKey(key);
    setShowForm(true);
  };

  const handleDeleteKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to delete this PGP key? This action cannot be undone.')) {
      return;
    }

    try {
      await deletePgpKey(keyId);
      await loadPgpKeys(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete PGP key');
    }
  };

  const handleFormSubmit = async (formData: CreatePgpKeyRequest | UpdatePgpKeyRequest) => {
    try {
      setError(null);
      
      if (editingKey) {
        // Update existing key
        await updatePgpKey(editingKey.id!, formData as UpdatePgpKeyRequest);
      } else {
        // Create new key
        await createPgpKey(formData as CreatePgpKeyRequest);
      }
      
      setShowForm(false);
      setEditingKey(null);
      await loadPgpKeys(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save PGP key');
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingKey(null);
    setError(null);
  };

  if (showForm) {
    return (
      <PgpKeyForm
        key={editingKey?.id || 'new'}
        pgpKey={editingKey}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        error={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🔐</span>
            <h1 className="text-2xl font-semibold text-gray-900">PGP Keys</h1>
          </div>
          <p className="mt-2 text-sm text-gray-700">
            Manage PGP public keys for encrypting files during SFTP uploads. 
            Add your public keys here and then assign them to specific SFTP configurations.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={handleCreateKey}
            className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
          >
            <span className="-ml-0.5" aria-hidden="true">+</span>
            Add PGP Key
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="rounded-md bg-red-50 px-2 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-sm text-gray-500">Loading PGP keys...</span>
        </div>
      ) : (
        /* PGP Keys Table */
        <PgpKeysTable
          pgpKeys={pgpKeys}
          onEdit={handleEditKey}
          onDelete={handleDeleteKey}
          onRefresh={loadPgpKeys}
        />
      )}

      {/* Empty State */}
      {!loading && pgpKeys.length === 0 && !error && (
        <div className="text-center py-12">
          <span className="mx-auto block text-4xl text-gray-400">🔐</span>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No PGP keys</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first PGP key for file encryption.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleCreateKey}
              className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
            >
              <span className="-ml-0.5" aria-hidden="true">+</span>
              Add your first PGP key
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PgpKeysManager;