import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SharePointService } from '../services/SharePointService';

/**
 * SharePoint API Functions
 * Provides endpoints for SharePoint integration via Microsoft Graph API
 */

/**
 * Get all SharePoint sites
 * GET /api/sharepoint/sites
 */
export async function getSharePointSites(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    context.log('📡 SharePoint sites request started');

    // Get configuration from environment variables
    const config = {
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    };

    if (!config.tenantId || !config.clientId || !config.clientSecret) {
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        jsonBody: {
          success: false,
          error: 'Missing Azure AD configuration'
        }
      };
    }

    const sharePointService = new SharePointService(context, config);
    const sites = await sharePointService.getSites();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: true,
        data: sites,
        count: sites.length
      }
    };
  } catch (error) {
    context.error('❌ Error getting SharePoint sites:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: false,
        error: 'Failed to get SharePoint sites',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Get drives (document libraries) for a SharePoint site
 * GET /api/sharepoint/sites/{siteId}/drives
 */
export async function getSharePointDrives(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const siteId = request.params.siteId;
    if (!siteId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        jsonBody: {
          success: false,
          error: 'Site ID is required'
        }
      };
    }

    context.log(`📡 SharePoint drives request for site: ${siteId}`);

    const config = {
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    };

    const sharePointService = new SharePointService(context, config);
    const drives = await sharePointService.getDrives(siteId);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: true,
        data: drives,
        count: drives.length,
        siteId
      }
    };
  } catch (error) {
    context.error('❌ Error getting SharePoint drives:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: false,
        error: 'Failed to get SharePoint drives',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Get items (files and folders) from a SharePoint drive
 * GET /api/sharepoint/drives/{driveId}/items?itemId={itemId}
 */
export async function getSharePointItems(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const driveId = request.params.driveId;
    const itemId = request.query.get('itemId') || 'root';
    
    if (!driveId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        jsonBody: {
          success: false,
          error: 'Drive ID is required'
        }
      };
    }

    context.log(`📡 SharePoint items request for drive: ${driveId}, item: ${itemId}`);

    const config = {
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    };

    const sharePointService = new SharePointService(context, config);
    const items = await sharePointService.getItems(driveId, itemId);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: true,
        data: items,
        count: items.length,
        driveId,
        itemId
      }
    };
  } catch (error) {
    context.error('❌ Error getting SharePoint items:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: false,
        error: 'Failed to get SharePoint items',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Download a file from SharePoint
 * GET /api/sharepoint/drives/{driveId}/items/{itemId}/download
 */
export async function downloadSharePointFile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const driveId = request.params.driveId;
    const itemId = request.params.itemId;
    
    if (!driveId || !itemId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        jsonBody: {
          success: false,
          error: 'Drive ID and Item ID are required'
        }
      };
    }

    context.log(`📥 SharePoint file download: drive ${driveId}, item ${itemId}`);

    const config = {
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    };

    const sharePointService = new SharePointService(context, config);
    
    // Get file info first
    const fileInfo = await sharePointService.getFileInfo(driveId, itemId);
    
    // Download file content
    const fileContent = await sharePointService.downloadFile(driveId, itemId);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileInfo.name}"`,
        'Access-Control-Allow-Origin': '*',
        'Content-Length': fileContent.length.toString(),
      },
      body: fileContent
    };
  } catch (error) {
    context.error('❌ Error downloading SharePoint file:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: false,
        error: 'Failed to download SharePoint file',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Search files in SharePoint
 * GET /api/sharepoint/search?q={query}&siteId={siteId}
 */
export async function searchSharePointFiles(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const query = request.query.get('q');
    const siteId = request.query.get('siteId');
    
    if (!query) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        jsonBody: {
          success: false,
          error: 'Search query is required'
        }
      };
    }

    context.log(`🔎 SharePoint search request: ${query}`);

    const config = {
      tenantId: process.env.AZURE_TENANT_ID!,
      clientId: process.env.AZURE_CLIENT_ID!,
      clientSecret: process.env.AZURE_CLIENT_SECRET!,
    };

    const sharePointService = new SharePointService(context, config);
    const results = await sharePointService.searchFiles(query, siteId);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: true,
        data: results,
        count: results.length,
        query,
        siteId
      }
    };
  } catch (error) {
    context.error('❌ Error searching SharePoint files:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: {
        success: false,
        error: 'Failed to search SharePoint files',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register the functions
app.http('getSharePointSites', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sharepoint/sites',
  handler: getSharePointSites
});

app.http('getSharePointDrives', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sharepoint/sites/{siteId}/drives',
  handler: getSharePointDrives
});

app.http('getSharePointItems', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sharepoint/drives/{driveId}/items',
  handler: getSharePointItems
});

app.http('downloadSharePointFile', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'sharepoint/drives/{driveId}/items/{itemId}/download',
  handler: downloadSharePointFile
});

app.http('searchSharePointFiles', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sharepoint/search',
  handler: searchSharePointFiles
});