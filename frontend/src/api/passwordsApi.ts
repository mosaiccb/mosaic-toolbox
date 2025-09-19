import { useState, useCallback } from 'react';
import { useAuthToken } from '../hooks/useAuthToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mosaic-toolbox.azurewebsites.net/api';

export interface PasswordEntry {
  id: string;
  title: string;
  username?: string;
  website?: string;
  notes?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
}

export interface PasswordEntryWithPassword extends PasswordEntry {
  password: string;
}

export interface CreatePasswordRequest {
  title: string;
  username?: string;
  password: string;
  website?: string;
  notes?: string;
  category?: string;
  favorite?: boolean;
}

export interface UpdatePasswordRequest {
  title?: string;
  username?: string;
  password?: string;
  website?: string;
  notes?: string;
  category?: string;
  favorite?: boolean;
}

export const usePasswordsApi = () => {
  const { getToken } = useAuthToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();

    if (!token) {
      throw new Error('Authentication required');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-tenant-id': '00000000-0000-0000-0000-000000000000', // TODO: Get from tenant context
    };
  }, [getToken]);

  const handleApiCall = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPasswords = useCallback(async (): Promise<PasswordEntry[]> => {
    return handleApiCall(async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/passwords`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch passwords: ${response.statusText}`);
      }
      return response.json();
    });
  }, [getAuthHeaders]);

  const getPassword = useCallback(async (id: string): Promise<PasswordEntryWithPassword> => {
    return handleApiCall(async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/passwords/${id}`, {
        method: 'GET',
        headers,
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch password: ${response.statusText}`);
      }
      return response.json();
    });
  }, [getAuthHeaders]);

  const createPassword = useCallback(async (passwordData: CreatePasswordRequest): Promise<PasswordEntry> => {
    return handleApiCall(async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/passwords`, {
        method: 'POST',
        headers,
        body: JSON.stringify(passwordData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create password: ${response.statusText}`);
      }
      return response.json();
    });
  }, [getAuthHeaders]);

  const updatePassword = useCallback(async (id: string, passwordData: UpdatePasswordRequest): Promise<PasswordEntry> => {
    return handleApiCall(async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/passwords/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(passwordData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update password: ${response.statusText}`);
      }
      return response.json();
    });
  }, [getAuthHeaders]);

  const deletePassword = useCallback(async (id: string): Promise<void> => {
    return handleApiCall(async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/passwords/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete password: ${response.statusText}`);
      }
    });
  }, [getAuthHeaders]);

  return {
    loading,
    error,
    getPasswords,
    getPassword,
    createPassword,
    updatePassword,
    deletePassword,
  };
};