import { useCallback } from 'react';
import { useAuthToken } from '../hooks/useAuthToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mosaic-toolbox.azurewebsites.net/api';

export interface PgpKey {
  id?: number;
  tenantId: string;
  name: string;
  description?: string;
  keyVaultSecretName?: string;
  fingerprint?: string;
  publicKeyArmored?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
  usageCount?: number;
}

export interface CreatePgpKeyRequest {
  name: string;
  description?: string;
  keyType: 'public' | 'private';
  keyData: string; // PGP key in ASCII armored format
}

export interface UpdatePgpKeyRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface PgpKeyValidationResult {
  isValid: boolean;
  fingerprint?: string;
  userIds?: string[];
  keyType?: string;
  error?: string;
}

export interface PgpKeyUsageStats {
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

// Custom hook for PGP key API operations
export const usePgpKeysApi = () => {
  const { getToken } = useAuthToken();

  const makeRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': '00000000-0000-0000-0000-000000000000', // TODO: Get from context
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }, [getToken]);

  // Get all PGP keys for the current tenant
  const listPgpKeys = useCallback(async (): Promise<PgpKey[]> => {
    try {
      const response = await makeRequest('/pgp/keys/list');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch PGP keys:', error);
      throw error;
    }
  }, [makeRequest]);

  // Get a specific PGP key by ID
  const getPgpKey = useCallback(async (id: number): Promise<PgpKey> => {
    try {
      const response = await makeRequest(`/pgp/keys/get/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch PGP key ${id}:`, error);
      throw error;
    }
  }, [makeRequest]);

  // Create a new PGP key
  const createPgpKey = useCallback(async (keyData: CreatePgpKeyRequest): Promise<PgpKey> => {
    try {
      const response = await makeRequest('/pgp/keys', {
        method: 'POST',
        body: JSON.stringify(keyData),
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create PGP key:', error);
      throw error;
    }
  }, [makeRequest]);

  // Update an existing PGP key
  const updatePgpKey = useCallback(async (id: number, keyData: UpdatePgpKeyRequest): Promise<PgpKey> => {
    try {
      const response = await makeRequest(`/pgp/keys/update/${id}`, {
        method: 'PUT',
        body: JSON.stringify(keyData),
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to update PGP key ${id}:`, error);
      throw error;
    }
  }, [makeRequest]);

  // Delete a PGP key
  const deletePgpKey = useCallback(async (id: number): Promise<void> => {
    try {
      await makeRequest(`/pgp/keys/delete/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Failed to delete PGP key ${id}:`, error);
      throw error;
    }
  }, [makeRequest]);

  // Get usage statistics for a PGP key
  const getPgpKeyUsageStats = useCallback(async (id: number): Promise<PgpKeyUsageStats> => {
    try {
      const response = await makeRequest(`/pgp/keys/${id}/usage`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch usage stats for PGP key ${id}:`, error);
      throw error;
    }
  }, [makeRequest]);

  return {
    listPgpKeys,
    getPgpKey,
    createPgpKey,
    updatePgpKey,
    deletePgpKey,
    getPgpKeyUsageStats,
  };
};