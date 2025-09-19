import React, { useState, useEffect } from 'react';
import { type PgpKey, type CreatePgpKeyRequest, type UpdatePgpKeyRequest } from '../../api/pgpService';

interface PgpKeyFormProps {
  pgpKey?: PgpKey | null;
  onSubmit: (data: CreatePgpKeyRequest | UpdatePgpKeyRequest) => Promise<void>;
  onCancel: () => void;
  error?: string | null;
}

const PgpKeyForm: React.FC<PgpKeyFormProps> = ({
  pgpKey,
  onSubmit,
  onCancel,
  error,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    publicKeyArmored: '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (pgpKey) {
      setFormData({
        name: pgpKey.name || '',
        description: pgpKey.description || '',
        publicKeyArmored: '', // Don't prefill the key for security
      });
    }
  }, [pgpKey]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setValidationError('Please enter a name for the PGP key');
      return;
    }

    if (!pgpKey && !formData.publicKeyArmored.trim()) {
      setValidationError('Please enter a PGP public key');
      return;
    }

    // Basic client-side validation for PGP key format
    if (!pgpKey && formData.publicKeyArmored.trim()) {
      const keyContent = formData.publicKeyArmored.trim();
      
      // Check for PGP public key markers
      if (!keyContent.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
        if (keyContent.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----')) {
          setValidationError('Private keys are not allowed. Please provide a PGP public key.');
        } else if (keyContent.includes('-----BEGIN')) {
          setValidationError('Unrecognized PGP key format. Please ensure you are pasting a PGP PUBLIC key block.');
        } else {
          setValidationError('Invalid PGP key format. Must be an armored PGP public key starting with "-----BEGIN PGP PUBLIC KEY BLOCK-----"');
        }
        return;
      }
      
      if (!keyContent.includes('-----END PGP PUBLIC KEY BLOCK-----')) {
        setValidationError('Invalid PGP key format. Must end with "-----END PGP PUBLIC KEY BLOCK-----"');
        return;
      }
    }

    setSubmitting(true);
    try {
      const submitData: CreatePgpKeyRequest | UpdatePgpKeyRequest = pgpKey
        ? { name: formData.name, description: formData.description } // Update request
        : { 
            name: formData.name, 
            description: formData.description, 
            keyType: 'public' as const,
            keyData: formData.publicKeyArmored 
          }; // Create request

      await onSubmit(submitData);
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = !!pgpKey;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isEditing ? 'Edit PGP Key' : 'Add New PGP Key'}
        </h1>
        <p className="mt-2 text-sm text-gray-700">
          {isEditing 
            ? 'Update the name and description of your PGP key.'
            : 'Add a new PGP public key for encrypting files during SFTP uploads.'
          }
        </p>
      </div>

      {/* Error Alert */}
      {(error || validationError) && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || validationError}</p>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg">
        <div className="px-4 py-5 sm:p-6 space-y-6">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name *
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter a friendly name for this PGP key"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              A friendly name to identify this PGP key in your configurations.
            </p>
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <div className="mt-1">
              <textarea
                name="description"
                id="description"
                rows={3}
                value={formData.description}
                onChange={handleInputChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Optional description for this PGP key"
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Optional description to help identify the purpose or owner of this key.
            </p>
          </div>

          {/* PGP Public Key Field (only for new keys) */}
          {!isEditing && (
            <div>
              <label htmlFor="publicKeyArmored" className="block text-sm font-medium text-gray-700">
                PGP Public Key *
              </label>
              <div className="mt-1">
                <textarea
                  name="publicKeyArmored"
                  id="publicKeyArmored"
                  rows={12}
                  required
                  value={formData.publicKeyArmored}
                  onChange={handleInputChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm font-mono text-xs"
                  placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----&#10;&#10;Paste your PGP public key here...&#10;&#10;-----END PGP PUBLIC KEY BLOCK-----"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Paste your armored PGP public key. Only public keys are accepted.
              </p>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="px-4 py-4 sm:px-6 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : isEditing ? 'Update PGP Key' : 'Add PGP Key'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PgpKeyForm;