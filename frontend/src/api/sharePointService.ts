import { useCallback } from 'react';
import { useAuthToken } from '../hooks/useAuthToken';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://mosaic-toolbox.azurewebsites.net/api';

// SharePoint Configuration interfaces
export interface SharePointConfiguration {
  id: number;
  tenantId: string;
  name: string;
  description?: string;
  tenantDomain: string;
  clientId: string;
  keyVaultSecretName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CreateSharePointConfigurationRequest {
  name: string;
  description?: string;
  tenantDomain: string;
  clientId: string;
  clientSecret: string;
}

export interface UpdateSharePointConfigurationRequest {
  name?: string;
  description?: string;
  tenantDomain?: string;
  clientId?: string;
  clientSecret?: string;
  isActive?: boolean;
}

// SharePoint Site interfaces
export interface SharePointSite {
  id: number;
  configurationId: number;
  siteId: string;
  siteName: string;
  siteUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSharePointSiteRequest {
  configurationId: number;
  siteId: string;
  siteName: string;
  siteUrl: string;
}

export interface UpdateSharePointSiteRequest {
  siteName?: string;
  siteUrl?: string;
  isActive?: boolean;
}

// SharePoint Library interfaces
export interface SharePointLibrary {
  id: number;
  siteId: number;
  libraryId: string;
  libraryName: string;
  libraryPath: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSharePointLibraryRequest {
  siteId: number;
  libraryId: string;
  libraryName: string;
  libraryPath: string;
}

export interface UpdateSharePointLibraryRequest {
  libraryName?: string;
  libraryPath?: string;
  isActive?: boolean;
}

// SharePoint Transfer Job interfaces
export interface SharePointTransferJob {
  id: number;
  tenantId: string;
  name: string;
  description?: string;
  sharePointLibraryId: number;
  sftpConfigurationId: number;
  scheduleCron?: string;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CreateSharePointTransferJobRequest {
  name: string;
  description?: string;
  sharePointLibraryId: number;
  sftpConfigurationId: number;
  scheduleCron?: string;
}

export interface UpdateSharePointTransferJobRequest {
  name?: string;
  description?: string;
  sharePointLibraryId?: number;
  sftpConfigurationId?: number;
  scheduleCron?: string;
  isActive?: boolean;
}

// SharePoint File Transfer interfaces
export interface SharePointFileTransfer {
  id: number;
  transferJobId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  transferStatus: string;
  errorMessage?: string;
  transferredAt: string;
}

// SharePoint Browse interfaces
export interface SharePointItem {
  id: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  size?: number;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
}

export interface SharePointDrive {
  id: string;
  name: string;
  description?: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export interface SharePointSiteInfo {
  id: string;
  displayName: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

// Custom hook for SharePoint API operations
export const useSharePointApi = () => {
  const { getToken } = useAuthToken();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getToken();

    if (!token) {
      throw new Error('Authentication required');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-tenant-id': '00000000-0000-0000-0000-000000000000', // Default tenant ID for testing
    };
  }, [getToken]);

  const getSharePointConfigurations = useCallback(async (): Promise<SharePointConfiguration[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/configurations/list`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get SharePoint configurations: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching SharePoint configurations:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const getSharePointConfiguration = useCallback(async (configId: number): Promise<SharePointConfiguration> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/configurations/get/${configId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch SharePoint configuration: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching SharePoint configuration:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const createSharePointConfiguration = useCallback(async (config: CreateSharePointConfigurationRequest): Promise<{ id: number }> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/configurations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create SharePoint configuration: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error creating SharePoint configuration:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const updateSharePointConfiguration = useCallback(async (configId: number, config: UpdateSharePointConfigurationRequest): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/configurations/update/${configId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update SharePoint configuration: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating SharePoint configuration:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const deleteSharePointConfiguration = useCallback(async (configId: number): Promise<void> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/configurations/delete/${configId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete SharePoint configuration: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting SharePoint configuration:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const getSharePointSites = useCallback(async (configId: number): Promise<SharePointSite[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/configurations/${configId}/sites`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch SharePoint sites: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching SharePoint sites:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const getSharePointLibraries = useCallback(async (siteId: number): Promise<SharePointLibrary[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/sites/${siteId}/libraries`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch SharePoint libraries: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching SharePoint libraries:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const browseSharePointSites = useCallback(async (configId: number): Promise<SharePointSiteInfo[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/sites?configId=${configId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to browse SharePoint sites: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error browsing SharePoint sites:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const browseSharePointDrives = useCallback(async (configId: number, siteId: string): Promise<SharePointDrive[]> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/sharepoint/drives?configId=${configId}&siteId=${siteId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to browse SharePoint drives: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error browsing SharePoint drives:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const browseSharePointItems = useCallback(async (
    configId: number, 
    siteId: string, 
    driveId: string, 
    itemId?: string
  ): Promise<SharePointItem[]> => {
    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${API_BASE_URL}/sharepoint/items`);
      url.searchParams.append('configId', configId.toString());
      url.searchParams.append('siteId', siteId);
      url.searchParams.append('driveId', driveId);
      if (itemId) {
        url.searchParams.append('itemId', itemId);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to browse SharePoint items: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error browsing SharePoint items:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const downloadSharePointFile = useCallback(async (
    configId: number,
    siteId: string,
    driveId: string,
    itemId: string
  ): Promise<Blob> => {
    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${API_BASE_URL}/sharepoint/download`);
      url.searchParams.append('configId', configId.toString());
      url.searchParams.append('siteId', siteId);
      url.searchParams.append('driveId', driveId);
      url.searchParams.append('itemId', itemId);

      const downloadHeaders = { ...headers };
      delete downloadHeaders['Content-Type']; // Let browser set content type for file download

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: downloadHeaders,
      });

      if (!response.ok) {
        throw new Error(`Failed to download SharePoint file: ${response.statusText}`);
      }

      return response.blob();
    } catch (error) {
      console.error('Error downloading SharePoint file:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  const searchSharePointFiles = useCallback(async (
    configId: number,
    query: string,
    siteId?: string
  ): Promise<SharePointItem[]> => {
    try {
      const headers = await getAuthHeaders();
      const url = new URL(`${API_BASE_URL}/sharepoint/search`);
      url.searchParams.append('configId', configId.toString());
      url.searchParams.append('query', query);
      if (siteId) {
        url.searchParams.append('siteId', siteId);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to search SharePoint files: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error searching SharePoint files:', error);
      throw error;
    }
  }, [getAuthHeaders]);

  return {
    // Configuration operations
    getSharePointConfigurations,
    getSharePointConfiguration,
    createSharePointConfiguration,
    updateSharePointConfiguration,
    deleteSharePointConfiguration,
    
    // Site and Library operations
    getSharePointSites,
    getSharePointLibraries,
    
    // Browse operations
    browseSharePointSites,
    browseSharePointDrives,
    browseSharePointItems,
    downloadSharePointFile,
    searchSharePointFiles,
  };
};