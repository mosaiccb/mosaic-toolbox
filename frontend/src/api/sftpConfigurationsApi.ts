import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mosaic-toolbox.azurewebsites.net/api';

export interface SftpConfiguration {
  id?: number;
  tenantId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  keyVaultSecretName: string;
  remotePath?: string;
  configurationJson?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreateSftpConfigurationRequest {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  keyVaultSecretName: string;
  remotePath?: string;
  configurationJson?: string;
}

export interface UpdateSftpConfigurationRequest {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  authMethod?: string;
  keyVaultSecretName?: string;
  remotePath?: string;
  configurationJson?: string;
  isActive?: boolean;
}

// Custom hook for SFTP configuration API operations
export const useSftpConfigurationsApi = () => {
  const { getToken } = useAuth();

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const token = await getToken();

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-tenant-id': '00000000-0000-0000-0000-000000000000', // TODO: Get from tenant context
    };
  };

  const getSftpConfigurations = async (): Promise<SftpConfiguration[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sftp/configurations`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get SFTP configurations: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error getting SFTP configurations:', error);
      throw error;
    }
  };

  const getSftpConfiguration = async (id: number): Promise<SftpConfiguration> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sftp/configurations/${id}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get SFTP configuration: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error getting SFTP configuration:', error);
      throw error;
    }
  };

  const createSftpConfiguration = async (config: CreateSftpConfigurationRequest): Promise<SftpConfiguration> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sftp/configurations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to create SFTP configuration: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error creating SFTP configuration:', error);
      throw error;
    }
  };

  const updateSftpConfiguration = async (id: number, config: UpdateSftpConfigurationRequest): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sftp/configurations/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to update SFTP configuration: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating SFTP configuration:', error);
      throw error;
    }
  };

  const deleteSftpConfiguration = async (id: number): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sftp/configurations/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to delete SFTP configuration: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting SFTP configuration:', error);
      throw error;
    }
  };

  return {
    getSftpConfigurations,
    getSftpConfiguration,
    createSftpConfiguration,
    updateSftpConfiguration,
    deleteSftpConfiguration,
  };
};