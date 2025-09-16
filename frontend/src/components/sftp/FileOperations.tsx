import React, { useState } from 'react';
import { useSftpApi } from '../../api/sftpApi';
import type { SftpFile } from '../../api/sftpApi';

interface FileOperationsProps {
  selectedFile?: SftpFile;
  currentPath: string;
  onOperationComplete?: () => void;
  onError?: (error: string) => void;
  configId: number;
}

const FileOperations: React.FC<FileOperationsProps> = ({
  selectedFile,
  currentPath,
  onOperationComplete,
  onError,
  configId
}) => {
  const { downloadFile, deleteFile, createDirectory } = useSftpApi();
  const [operationInProgress, setOperationInProgress] = useState<string | null>(null);
  const [newDirName, setNewDirName] = useState('');
  const [showCreateDir, setShowCreateDir] = useState(false);

  const handleDownload = async () => {
    if (!selectedFile || selectedFile.type !== 'file') return;

    setOperationInProgress('download');
    try {
      const blob = await downloadFile(selectedFile.path, configId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onOperationComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Download failed';
      onError?.(errorMessage);
    } finally {
      setOperationInProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;

    const confirmMessage = `Are you sure you want to delete "${selectedFile.name}"?`;
    if (!window.confirm(confirmMessage)) return;

    setOperationInProgress('delete');
    try {
      await deleteFile(selectedFile.path, configId);
      onOperationComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      onError?.(errorMessage);
    } finally {
      setOperationInProgress(null);
    }
  };

  const handleCreateDirectory = async () => {
    if (!newDirName.trim()) return;

    const dirPath = currentPath === '/' ? `/${newDirName.trim()}` : `${currentPath}/${newDirName.trim()}`;

    setOperationInProgress('createDir');
    try {
      await createDirectory(dirPath, configId);
      setNewDirName('');
      setShowCreateDir(false);
      onOperationComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Create directory failed';
      onError?.(errorMessage);
    } finally {
      setOperationInProgress(null);
    }
  };

  const isOperationDisabled = operationInProgress !== null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-medium text-gray-900 mb-4">File Operations</h3>

      {/* Selected File Info */}
      {selectedFile && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Selected File</h4>
          <div className="text-sm text-gray-600">
            <p><strong>Name:</strong> {selectedFile.name}</p>
            <p><strong>Type:</strong> {selectedFile.type}</p>
            {selectedFile.size && <p><strong>Size:</strong> {formatFileSize(selectedFile.size)}</p>}
            {selectedFile.modified && <p><strong>Modified:</strong> {new Date(selectedFile.modified).toLocaleString()}</p>}
          </div>
        </div>
      )}

      {/* File Operations */}
      <div className="space-y-3">
        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={!selectedFile || selectedFile.type !== 'file' || isOperationDisabled}
          className={`
            w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white
            ${!selectedFile || selectedFile.type !== 'file' || isOperationDisabled
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }
          `}
        >
          {operationInProgress === 'download' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Downloading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586 14.293 5.293a1 1 0 111.414 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download File
            </>
          )}
        </button>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          disabled={!selectedFile || isOperationDisabled}
          className={`
            w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white
            ${!selectedFile || isOperationDisabled
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
            }
          `}
        >
          {operationInProgress === 'delete' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Deleting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Delete File/Directory
            </>
          )}
        </button>

        {/* Create Directory Section */}
        <div className="border-t border-gray-200 pt-3">
          <button
            onClick={() => setShowCreateDir(!showCreateDir)}
            disabled={isOperationDisabled}
            className={`
              w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700
              ${isOperationDisabled
                ? 'bg-gray-100 cursor-not-allowed'
                : 'bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }
            `}
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Create Directory
          </button>

          {showCreateDir && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                placeholder="Directory name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={isOperationDisabled}
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateDirectory}
                  disabled={!newDirName.trim() || isOperationDisabled}
                  className={`
                    flex-1 flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white
                    ${!newDirName.trim() || isOperationDisabled
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                    }
                  `}
                >
                  {operationInProgress === 'createDir' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateDir(false);
                    setNewDirName('');
                  }}
                  disabled={isOperationDisabled}
                  className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export default FileOperations;