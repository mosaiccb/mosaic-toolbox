import { useCallback } from 'react';
import { useAuthToken } from '../hooks/useAuthToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mosaic-toolbox.azurewebsites.net/api';

export interface SftpFile {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
  path: string;
}

export interface SftpConnection {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

// Custom hook for SFTP API operations
export const useSftpApi = () => {
  const { getToken } = useAuthToken();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-tenant-id': '00000000-0000-0000-0000-000000000000', // Default tenant ID for testing
    };
  }, [getToken]);

  const listFiles = useCallback(async (path: string = '/', configId: number): Promise<SftpFile[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sftp/list?path=${encodeURIComponent(path)}&configId=${configId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data = await response.json();
      return data.files || [];
    } catch (error) {
      console.error('Error listing SFTP files:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const uploadFile = useCallback(async (file: File, remotePath: string, configId: number): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      // Remove Content-Type header for FormData
      delete headers['Content-Type'];

      const formData = new FormData();
      formData.append('file', file);
      formData.append('remotePath', remotePath);
      formData.append('configId', configId.toString());

      const response = await fetch(`${API_BASE_URL}/sftp/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload file: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const downloadFile = useCallback(async (remotePath: string, configId: number): Promise<Blob> => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/sftp/download?path=${encodeURIComponent(remotePath)}&configId=${configId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const deleteFile = useCallback(async (remotePath: string, configId: number): Promise<void> => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/sftp/delete`, {
        method: 'DELETE',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: remotePath, configId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const createDirectory = useCallback(async (remotePath: string, configId: number): Promise<void> => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/sftp/mkdir`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ path: remotePath, configId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create directory: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error creating directory:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const getFileInfo = useCallback(async (remotePath: string, configId: number): Promise<SftpFile> => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/sftp/info?path=${encodeURIComponent(remotePath)}&configId=${configId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  return {
    listFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    createDirectory,
    getFileInfo,
  };
};