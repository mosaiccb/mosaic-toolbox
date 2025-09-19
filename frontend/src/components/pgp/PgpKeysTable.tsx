import React from 'react';
import type { PgpKey } from '../../api/pgpService';

interface PgpKeysTableProps {
  pgpKeys: PgpKey[];
  onEdit: (key: PgpKey) => void;
  onDelete: (keyId: number) => void;
  onRefresh: () => Promise<void>;
}

const PgpKeysTable: React.FC<PgpKeysTableProps> = ({
  pgpKeys,
  onEdit,
  onDelete,
  onRefresh,
}) => {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const formatFingerprint = (fingerprint?: string): string => {
    if (!fingerprint) return 'Unknown';
    // Format fingerprint with spaces every 4 characters for readability
    return fingerprint.replace(/(.{4})/g, '$1 ').trim();
  };

  if (pgpKeys.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No PGP keys found.</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .pgp-edit-btn {
          background-color: #4f46e5 !important;
          color: #ffffff !important;
          border: none !important;
        }
        .pgp-edit-btn:hover {
          background-color: #3730a3 !important;
        }
        .pgp-delete-btn {
          background-color: #dc2626 !important;
          color: #ffffff !important;
          border: none !important;
        }
        .pgp-delete-btn:hover {
          background-color: #b91c1c !important;
        }
      `}</style>
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            PGP Keys ({pgpKeys.length})
          </h3>
          <button
            onClick={onRefresh}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            Refresh
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '200px' }}>
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '250px' }}>
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '300px' }}>
                  Fingerprint
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '120px' }}>
                  Usage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '120px' }}>
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '100px' }}>
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '180px' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pgpKeys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900 truncate" style={{ maxWidth: '160px' }}>
                          {key.name || 'Unnamed Key'}
                        </div>
                        <div className="text-xs text-gray-500">
                          PGP Public Key
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 truncate" style={{ maxWidth: '220px' }} title={key.description || 'No description'}>
                      {key.description || 'No description'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs font-mono text-gray-600 truncate" style={{ maxWidth: '280px' }} title={formatFingerprint(key.fingerprint)}>
                      {formatFingerprint(key.fingerprint)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {key.usageCount || 0} times
                    </div>
                    <div className="text-xs text-gray-500">
                      Last: {formatDate(key.lastUsedAt)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(key.createdAt)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        key.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {key.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onEdit(key)}
                        className="pgp-edit-btn"
                        style={{
                          backgroundColor: '#4f46e5 !important',
                          color: '#ffffff !important',
                          border: 'none !important',
                          padding: '6px 12px !important',
                          fontSize: '12px !important',
                          fontWeight: '500 !important',
                          borderRadius: '6px !important',
                          display: 'inline-flex !important',
                          alignItems: 'center !important',
                          cursor: 'pointer !important',
                          transition: 'all 0.2s !important'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#3730a3';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#4f46e5';
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => key.id && onDelete(key.id)}
                        className="pgp-delete-btn"
                        style={{
                          backgroundColor: '#dc2626 !important',
                          color: '#ffffff !important',
                          border: 'none !important',
                          padding: '6px 12px !important',
                          fontSize: '12px !important',
                          fontWeight: '500 !important',
                          borderRadius: '6px !important',
                          display: 'inline-flex !important',
                          alignItems: 'center !important',
                          cursor: 'pointer !important',
                          transition: 'all 0.2s !important'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#b91c1c';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#dc2626';
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </>
  );
};

export default PgpKeysTable;