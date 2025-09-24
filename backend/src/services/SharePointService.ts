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
  siteName?: string;
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
   * Get subsites for a specific site
   */
  async getSubsites(siteId: string): Promise<SharePointSite[]> {
    try {
      this.context.log(`🔍 Getting subsites for site: ${siteId}`);
      
      // Get the hostname part
      const hostname = siteId.split(',')[0];
      
      let allSubsites: SharePointSite[] = [];

      // Try approach 1: Get subsites from the root site
      try {
        this.context.log(`🔗 Trying /sites/${hostname}/sites`);
        const subsites = await this.graphClient
          .api(`/sites/${hostname}/sites`)
          .select('id,name,displayName,webUrl,description')
          .get();

        const result1 = subsites.value.map((site: any) => ({
          id: site.id,
          name: site.name,
          displayName: site.displayName,
          webUrl: site.webUrl,
          description: site.description
        }));

        allSubsites.push(...result1);
        this.context.log(`📊 Found ${result1.length} direct subsites`);
      } catch (error) {
        this.context.log(`❌ Direct subsites approach failed: ${error.message}`);
      }

      // Try approach 2: Search for sites containing "clients" or "operations"
      try {
        this.context.log(`🔗 Searching for sites with 'clients' or 'operations'`);
        const searchResults = await this.graphClient
          .api('/sites')
          .filter("contains(name,'clients') or contains(name,'operations') or contains(displayName,'clients') or contains(displayName,'operations')")
          .select('id,name,displayName,webUrl,description')
          .get();

        const result2 = searchResults.value
          .filter((site: any) => site.webUrl.includes(hostname))
          .map((site: any) => ({
            id: site.id,
            name: site.name,
            displayName: site.displayName,
            webUrl: site.webUrl,
            description: site.description
          }));

        // Filter out duplicates
        const existingIds = new Set(allSubsites.map(s => s.id));
        const newSites = result2.filter((site: any) => !existingIds.has(site.id));
        allSubsites.push(...newSites);

        this.context.log(`📊 Found ${result2.length} sites via search (${newSites.length} new)`);
      } catch (error) {
        this.context.log(`❌ Search approach failed: ${error.message}`);
      }

      this.context.log(`📊 Total unique subsites found: ${allSubsites.length}`);
      return allSubsites;
    } catch (error) {
      this.context.error('❌ Error getting subsites:', error);
      return [];
    }
  }

  /**
   * Get all lists and libraries from a specific site
   */
  async getAllLists(siteId: string): Promise<any[]> {
    try {
      this.context.log(`🔍 Getting all lists for site: ${siteId}`);
      
      // Get the hostname part
      const hostname = siteId.split(',')[0];
      
      try {
        // Try to get all lists from the site
        const lists = await this.graphClient
          .api(`/sites/${hostname}/lists`)
          .select('id,name,displayName,description,list,webUrl,createdDateTime,lastModifiedDateTime')
          .get();

        const result = lists.value.map((list: any) => ({
          id: list.id,
          name: list.name,
          displayName: list.displayName,
          description: list.description,
          webUrl: list.webUrl,
          createdDateTime: list.createdDateTime,
          lastModifiedDateTime: list.lastModifiedDateTime,
          template: list.list?.template,
          hidden: list.list?.hidden
        }));

        this.context.log(`📋 Found ${result.length} lists/libraries`);
        return result;
      } catch (error) {
        this.context.log(`❌ Could not get lists: ${error.message}`);
        
        // Try with encoded site ID as fallback
        try {
          const encodedSiteId = encodeURIComponent(siteId);
          const lists = await this.graphClient
            .api(`/sites/${encodedSiteId}/lists`)
            .select('id,name,displayName,description,list,webUrl,createdDateTime,lastModifiedDateTime')
            .get();

          const result = lists.value.map((list: any) => ({
            id: list.id,
            name: list.name,
            displayName: list.displayName,
            description: list.description,
            webUrl: list.webUrl,
            createdDateTime: list.createdDateTime,
            lastModifiedDateTime: list.lastModifiedDateTime,
            template: list.list?.template,
            hidden: list.list?.hidden
          }));

          this.context.log(`📋 Found ${result.length} lists/libraries (encoded approach)`);
          return result;
        } catch (encodedError) {
          this.context.log(`❌ Encoded approach also failed: ${encodedError.message}`);
          throw new Error(`Cannot access site lists. Direct: ${error.message}. Encoded: ${encodedError.message}`);
        }
      }
    } catch (error) {
      this.context.error('❌ Error getting lists:', error);
      throw new Error(`Failed to get lists for site ${siteId}: ${error}`);
    }
  }

  /**
   * Get document libraries (drives) for a specific site and its subsites
   */
  async getDrives(siteId: string): Promise<SharePointDrive[]> {
    try {
      this.context.log(`🔍 Getting drives for site: ${siteId}`);
      
      let drives;
      
      // FIXED: Try the specific site ID first (this should work with proper permissions)
      try {
        this.context.log(`🎯 Trying specific site access: ${siteId}`);
        
        drives = await this.graphClient
          .api(`/sites/${siteId}/drives`)
          .select('id,name,driveType,webUrl')
          .get();
        
        this.context.log(`✅ Site-specific drives found: ${drives.value?.length || 0}`);
        
        // Log drive details for debugging
        drives.value?.forEach((drive: any) => {
          this.context.log(`  📂 Drive: ${drive.name} (${drive.driveType}) - ID: ${drive.id}`);
        });
        
      } catch (siteError) {
        this.context.log(`❌ Site-specific approach failed: ${siteError.message}`);
        
        // Fallback to root site (this was the original logic causing wrong drive IDs)
        try {
          const hostname = siteId.split(',')[0];
          this.context.log(`⚠️  FALLBACK: Trying root site access for hostname: ${hostname}`);
          this.context.log(`⚠️  WARNING: This may return drive IDs for root site instead of target site!`);
          
          drives = await this.graphClient
            .api(`/sites/${hostname}/drives`)
            .select('id,name,driveType,webUrl')
            .get();
          
          this.context.log(`⚠️  Root site drives found: ${drives.value?.length || 0} (may be for wrong site!)`);
        } catch (rootError) {
          this.context.log(`❌ Root site fallback also failed: ${rootError.message}`);
          
          // Try encoded approach as last resort
          try {
            const encodedSiteId = encodeURIComponent(siteId);
            this.context.log(`🔗 Last resort: Encoded site ID: ${encodedSiteId}`);
            
            drives = await this.graphClient
              .api(`/sites/${encodedSiteId}/drives`)
              .select('id,name,driveType,webUrl')
              .get();
              
            this.context.log(`✅ Encoded site drives found: ${drives.value?.length || 0}`);
          } catch (encodedError) {
            this.context.log(`❌ All approaches failed. Site: ${siteError.message}. Root: ${rootError.message}. Encoded: ${encodedError.message}`);
            throw new Error(`Cannot access site drives for ${siteId}. All methods failed.`);
          }
        }
      }

      let allDrives = drives.value.map((drive: any) => ({
        id: drive.id,
        name: drive.name,
        driveType: drive.driveType,
        webUrl: drive.webUrl,
        siteName: 'Root Site'
      }));

      this.context.log(`📂 Found ${allDrives.length} drives in root site`);

      // Also try to get drives from subsites
      try {
        this.context.log(`🔍 Attempting to get subsites for site: ${siteId}`);
        const subsites = await this.getSubsites(siteId);
        this.context.log(`🔍 Found ${subsites.length} subsites, checking for additional drives...`);

        for (const subsite of subsites) {
          try {
            this.context.log(`🔗 Getting drives for subsite: ${subsite.displayName || subsite.name} (${subsite.id})`);
            const hostname = subsite.id.split(',')[0];
            const subsiteDrives = await this.graphClient
              .api(`/sites/${hostname}/drives`)
              .select('id,name,driveType,webUrl')
              .get();

            const subsiteDrivesList = subsiteDrives.value.map((drive: any) => ({
              id: drive.id,
              name: `${subsite.displayName || subsite.name} - ${drive.name}`,
              driveType: drive.driveType,
              webUrl: drive.webUrl,
              siteName: subsite.displayName || subsite.name
            }));

            allDrives.push(...subsiteDrivesList);
            this.context.log(`📂 Found ${subsiteDrivesList.length} drives in subsite: ${subsite.displayName || subsite.name}`);
          } catch (subsiteError) {
            this.context.log(`⚠️ Could not access drives for subsite ${subsite.displayName || subsite.name}: ${subsiteError.message}`);
          }
        }
      } catch (subsiteError) {
        this.context.log(`⚠️ Could not get subsites: ${subsiteError.message}`);
      }

      this.context.log(`📂 Total drives found: ${allDrives.length}`);
      return allDrives;
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
      this.context.log(`🔗 API call: /drives/${driveId}/items/${itemId}/children`);
      
      const items = await this.graphClient
        .api(`/drives/${driveId}/items/${itemId}/children`)
        .select('id,name,size,lastModifiedDateTime,webUrl,folder,file,parentReference')
        .get();

      this.context.log(`📊 Raw API response: ${JSON.stringify(items, null, 2).substring(0, 500)}...`);

      const result = items.value.map((item: any) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        createdDateTime: item.createdDateTime,
        // FIXED: Return folder/file properties that match frontend interface
        folder: item.folder ? { childCount: item.folder.childCount || 0 } : undefined,
        file: item.file ? { mimeType: item.file.mimeType || 'application/octet-stream' } : undefined,
        parentPath: item.parentReference?.path || '',
        downloadUrl: item.file ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${item.id}/content` : undefined
      }));

      this.context.log(`📄 Found ${result.length} items in drive ${driveId}/${itemId}`);
      if (result.length === 0) {
        this.context.log(`⚠️  No items found - this could mean:`);
        this.context.log(`   - The folder is empty`);
        this.context.log(`   - Access permissions are insufficient`);
        this.context.log(`   - The drive/folder structure is different than expected`);
      }
      
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

  /**
   * Get items using drive-based approach (recommended pattern)
   */
  async getItemsByDriveId(driveId: string, folderPath: string = '', context: InvocationContext): Promise<any[]> {
    try {
      context.log(`📁 Getting items for drive ${driveId}, folder: ${folderPath || 'root'}`);
      
      let endpoint;
      if (!folderPath || folderPath === 'root') {
        endpoint = `/drives/${driveId}/root/children`;
      } else {
        endpoint = `/drives/${driveId}/root:/${folderPath}:/children`;
      }
      
      context.log(`🔍 Using endpoint: ${endpoint}`);
      
      const response = await this.graphClient
        .api(endpoint)
        .get();

      context.log(`✅ Found ${response.value?.length || 0} items`);
      return response.value || [];
    } catch (error: any) {
      context.log(`❌ Error getting drive items: ${error.message} - Status: ${error.status || 'Unknown'}`);
      throw error;
    }
  }

  /**
   * Get Site Pages for a SharePoint site
   */
  async getSitePages(siteId: string, context: InvocationContext): Promise<any[]> {
    try {
      context.log(`📄 Getting Site Pages for site: ${siteId}`);
      
      // Try different API endpoints for Site Pages
      const endpoints = [
        `/sites/${siteId}/pages`,
        `/sites/${siteId}/lists/SitePages/items`,
        `/sites/${siteId}/lists/Site Pages/items`
      ];

      for (const endpoint of endpoints) {
        try {
          context.log(`🔍 Trying endpoint: ${endpoint}`);
          const response = await this.graphClient
            .api(endpoint)
            .get();

          context.log(`✅ Found ${response.value?.length || 0} pages via ${endpoint}`);
          return response.value || [];
        } catch (endpointError: any) {
          context.log(`❌ Failed ${endpoint}: ${endpointError.message} - Status: ${endpointError.status || 'Unknown'}`);
          continue;
        }
      }

      throw new Error('All Site Pages endpoints failed');
    } catch (error: any) {
      context.log(`❌ Error getting Site Pages: ${error.message} - Status: ${error.status || 'Unknown'}`);
      throw error;
    }
  }
}