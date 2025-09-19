import { InvocationContext } from '@azure/functions';
import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';

interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
  description?: string;
}

interface SharePointDrive {
  id: string;
  name: string;
  driveType: string;
  webUrl: string;
}

interface SharePointItem {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime: string;
  webUrl: string;
  downloadUrl?: string;
  isFolder: boolean;
  parentPath: string;
}

/**
 * Custom Authentication Provider for Microsoft Graph API
 * Uses MSAL Node with client credentials flow
 */
class GraphAuthProvider implements AuthenticationProvider {
  private clientApp: ConfidentialClientApplication;

  constructor(config: SharePointConfig) {
    this.clientApp = new ConfidentialClientApplication({
      auth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
      },
    });
  }

  async getAccessToken(): Promise<string> {
    try {
      const response = await this.clientApp.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
      });
      return response?.accessToken || '';
    } catch (error) {
      throw new Error(`Failed to acquire token: ${error}`);
    }
  }
}

/**
 * SharePoint Service for Microsoft Graph API integration
 * Handles SharePoint sites, document libraries, and file operations
 */
export class SharePointService {
  private context: InvocationContext;
  private graphClient: Client;

  constructor(context: InvocationContext, config: SharePointConfig) {
    this.context = context;
    
    // Create Graph client with custom auth provider
    const authProvider = new GraphAuthProvider(config);
    this.graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: async () => {
          return await authProvider.getAccessToken();
        }
      }
    });
  }

  /**
   * Get all SharePoint sites accessible to the application
   */
  async getSites(): Promise<SharePointSite[]> {
    try {
      this.context.log('🔍 Getting SharePoint sites...');
      
      const sites = await this.graphClient
        .api('/sites')
        .select('id,name,displayName,webUrl,description')
        .get();

      const result = sites.value.map((site: any) => ({
        id: site.id,
        name: site.name,
        displayName: site.displayName,
        webUrl: site.webUrl,
        description: site.description
      }));

      this.context.log(`📊 Found ${result.length} SharePoint sites`);
      return result;
    } catch (error) {
      this.context.error('❌ Error getting SharePoint sites:', error);
      throw new Error(`Failed to get SharePoint sites: ${error}`);
    }
  }

  /**
   * Get document libraries (drives) for a specific site
   */
  async getDrives(siteId: string): Promise<SharePointDrive[]> {
    try {
      this.context.log(`🔍 Getting drives for site: ${siteId}`);
      
      const drives = await this.graphClient
        .api(`/sites/${siteId}/drives`)
        .select('id,name,driveType,webUrl')
        .get();

      const result = drives.value.map((drive: any) => ({
        id: drive.id,
        name: drive.name,
        driveType: drive.driveType,
        webUrl: drive.webUrl
      }));

      this.context.log(`📂 Found ${result.length} drives in site ${siteId}`);
      return result;
    } catch (error) {
      this.context.error('❌ Error getting drives:', error);
      throw new Error(`Failed to get drives for site ${siteId}: ${error}`);
    }
  }

  /**
   * Get items (files and folders) from a drive or folder
   */
  async getItems(driveId: string, itemId: string = 'root'): Promise<SharePointItem[]> {
    try {
      this.context.log(`🔍 Getting items from drive ${driveId}, item ${itemId}`);
      
      const items = await this.graphClient
        .api(`/drives/${driveId}/items/${itemId}/children`)
        .select('id,name,size,lastModifiedDateTime,webUrl,folder,file,parentReference')
        .get();

      const result = items.value.map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        isFolder: !!item.folder,
        parentPath: item.parentReference?.path || '',
        downloadUrl: item.file ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/content` : undefined
      }));

      this.context.log(`📄 Found ${result.length} items in drive ${driveId}/${itemId}`);
      return result;
    } catch (error) {
      this.context.error('❌ Error getting items:', error);
      throw new Error(`Failed to get items from drive ${driveId}: ${error}`);
    }
  }

  /**
   * Download a file from SharePoint
   */
  async downloadFile(driveId: string, itemId: string): Promise<Buffer> {
    try {
      this.context.log(`📥 Downloading file from drive ${driveId}, item ${itemId}`);
      
      const content = await this.graphClient
        .api(`/drives/${driveId}/items/${itemId}/content`)
        .get();

      this.context.log(`✅ File downloaded successfully from ${driveId}/${itemId}`);
      return Buffer.from(content);
    } catch (error) {
      this.context.error('❌ Error downloading file:', error);
      throw new Error(`Failed to download file ${itemId} from drive ${driveId}: ${error}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileInfo(driveId: string, itemId: string): Promise<SharePointItem> {
    try {
      this.context.log(`ℹ️ Getting file info for ${driveId}/${itemId}`);
      
      const item = await this.graphClient
        .api(`/drives/${driveId}/items/${itemId}`)
        .select('id,name,size,lastModifiedDateTime,webUrl,folder,file,parentReference')
        .get();

      const result: SharePointItem = {
        id: item.id,
        name: item.name,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        isFolder: !!item.folder,
        parentPath: item.parentReference?.path || '',
        downloadUrl: item.file ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/content` : undefined
      };

      this.context.log(`✅ File info retrieved for ${item.name}`);
      return result;
    } catch (error) {
      this.context.error('❌ Error getting file info:', error);
      throw new Error(`Failed to get file info for ${itemId}: ${error}`);
    }
  }

  /**
   * Search for files in SharePoint
   */
  async searchFiles(query: string, siteId?: string): Promise<SharePointItem[]> {
    try {
      this.context.log(`🔎 Searching for files with query: ${query}`);
      
      let searchUrl = `/search/query`;
      const searchBody = {
        requests: [{
          entityTypes: ['driveItem'],
          query: {
            queryString: query
          }
        }]
      };

      if (siteId) {
        searchBody.requests[0].query.queryString += ` path:"${siteId}"`;
      }

      const searchResults = await this.graphClient
        .api(searchUrl)
        .post(searchBody);

      const items = searchResults.value[0]?.hitsContainers[0]?.hits || [];
      const result = items.map((hit: any) => {
        const item = hit.resource;
        return {
          id: item.id,
          name: item.name,
          size: item.size,
          lastModifiedDateTime: item.lastModifiedDateTime,
          webUrl: item.webUrl,
          isFolder: item.folder !== undefined,
          parentPath: item.parentReference?.path || '',
          downloadUrl: item.file ? item.downloadUrl : undefined
        };
      });

      this.context.log(`📋 Found ${result.length} files matching query: ${query}`);
      return result;
    } catch (error) {
      this.context.error('❌ Error searching files:', error);
      throw new Error(`Failed to search files: ${error}`);
    }
  }
}