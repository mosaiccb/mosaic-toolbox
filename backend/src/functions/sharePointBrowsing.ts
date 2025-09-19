import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from '../services/TenantDatabaseService';
import { ClientSecretCredential } from '@azure/identity';
import axios from 'axios';

// Initialize the database service
const dbService = new TenantDatabaseService();

// SharePoint Browse interfaces
export interface SharePointSiteInfo {
  id: string;
  displayName: string;
  name: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export interface SharePointDrive {
  id: string;
  name: string;
  description?: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

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

// Helper function to get access token for Microsoft Graph API
async function getGraphAccessToken(configId: number, tenantId: string, context: InvocationContext): Promise<string> {
  // Get SharePoint configuration from database
  const configQuery = `
    SELECT Id, TenantId, Name, Description, TenantDomain, ClientId, KeyVaultSecretName,
           IsActive, CreatedAt, UpdatedAt
    FROM dbo.SharePointConfigurations
    WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
  `;

  const configurations = await dbService.executeQueryWithParams(configQuery, [
    { name: 'configId', type: 'int', value: configId },
    { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
  ]);

  if (configurations.length === 0) {
    throw new Error('SharePoint configuration not found');
  }

  const config = configurations[0];

  // Extract configId from KeyVaultSecretName (format: sharepoint-{configId}-clientsecret)
  const secretNameParts = config.KeyVaultSecretName.split('-');
  if (secretNameParts.length < 3 || !secretNameParts[1]) {
    throw new Error('Invalid KeyVault secret name format');
  }
  
  // The configId is everything between 'sharepoint-' and '-clientsecret'
  const configIdFromSecret = config.KeyVaultSecretName.replace('sharepoint-', '').replace('-clientsecret', '');
  
  // Get client secret from Key Vault
  const clientSecret = await dbService.getSharePointClientSecret(tenantId, configIdFromSecret);
  
  if (!clientSecret) {
    throw new Error('SharePoint client secret not found');
  }

  // Extract tenant ID from domain (e.g., mosaicemployersolutions.sharepoint.com -> mosaicemployersolutions.onmicrosoft.com)
  const tenantDomain = config.TenantDomain;
  const tenantName = tenantDomain.split('.')[0];
  const azureTenantId = `${tenantName}.onmicrosoft.com`;

  context.log(`Getting access token for tenant: ${azureTenantId}, clientId: ${config.ClientId}`);

  // Create Azure credential
  const credential = new ClientSecretCredential(
    azureTenantId,
    config.ClientId,
    clientSecret
  );

  // Get access token
  const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
  
  if (!tokenResponse?.token) {
    throw new Error('Failed to get access token');
  }

  return tokenResponse.token;
}

// Browse SharePoint sites
export async function browseSharePointSites(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const tenantId = request.headers.get('x-tenant-id');
    const configId = request.query.get('configId');

    if (!tenantId || !configId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID and Configuration ID are required'
        }
      };
    }

    const configIdNumber = parseInt(configId, 10);
    if (isNaN(configIdNumber)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid configuration ID'
        }
      };
    }

    context.log(`Browsing SharePoint sites for config ${configId} and tenant: ${tenantId}`);

    // Get access token
    const accessToken = await getGraphAccessToken(configIdNumber, tenantId, context);

    // Get sites from Microsoft Graph API
    const response = await axios.get('https://graph.microsoft.com/v1.0/sites', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result: SharePointSiteInfo[] = response.data.value?.map((site: any) => ({
      id: site.id,
      displayName: site.displayName || site.name || 'Unknown Site',
      name: site.name || site.displayName || 'Unknown Site',
      webUrl: site.webUrl,
      createdDateTime: site.createdDateTime,
      lastModifiedDateTime: site.lastModifiedDateTime
    })) || [];

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: result
      }
    };
  } catch (error) {
    context.error('Error browsing SharePoint sites:', error);
    
    // Provide more specific error information
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for authentication errors
      if (errorMessage.includes('AADSTS') || errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        statusCode = 401;
        errorMessage = 'SharePoint authentication failed. Please check client ID and secret.';
      } else if (errorMessage.includes('tenant') || errorMessage.includes('AADSTS50020')) {
        statusCode = 401;
        errorMessage = 'Invalid SharePoint tenant. Please check tenant domain.';
      } else if (errorMessage.includes('not found')) {
        statusCode = 404;
        errorMessage = 'SharePoint configuration not found.';
      }
    }
    
    return {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }
    };
  }
}

// Browse SharePoint drives for a specific site
export async function browseSharePointDrives(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const tenantId = request.headers.get('x-tenant-id');
    const configId = request.query.get('configId');
    const siteId = request.query.get('siteId');

    if (!tenantId || !configId || !siteId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID, Configuration ID, and Site ID are required'
        }
      };
    }

    const configIdNumber = parseInt(configId, 10);
    if (isNaN(configIdNumber)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid configuration ID'
        }
      };
    }

    context.log(`Browsing SharePoint drives for site ${siteId}, config ${configId} and tenant: ${tenantId}`);

    // Get access token
    const accessToken = await getGraphAccessToken(configIdNumber, tenantId, context);

    // Get drives for the site from Microsoft Graph API
    const response = await axios.get(`https://graph.microsoft.com/v1.0/sites/${siteId}/drives`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result: SharePointDrive[] = response.data.value?.map((drive: any) => ({
      id: drive.id,
      name: drive.name,
      description: drive.description,
      webUrl: drive.webUrl,
      createdDateTime: drive.createdDateTime,
      lastModifiedDateTime: drive.lastModifiedDateTime
    })) || [];

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: result
      }
    };
  } catch (error) {
    context.error('Error browsing SharePoint drives:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }
    };
  }
}

// Test SharePoint connection
export async function testSharePointConnection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const tenantId = request.headers.get('x-tenant-id');
    const configId = request.query.get('configId');

    if (!tenantId || !configId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID and Configuration ID are required'
        }
      };
    }

    const configIdNumber = parseInt(configId, 10);
    if (isNaN(configIdNumber)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid configuration ID'
        }
      };
    }

    context.log(`Testing SharePoint connection for config ${configId} and tenant: ${tenantId}`);

    // Get access token
    const accessToken = await getGraphAccessToken(configIdNumber, tenantId, context);

    // Test connection by getting basic user info
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        message: 'SharePoint connection successful',
        data: {
          connected: true,
          userPrincipalName: response.data.userPrincipalName,
          displayName: response.data.displayName
        }
      }
    };
  } catch (error) {
    context.error('Error testing SharePoint connection:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: error instanceof Error ? error.message : 'SharePoint connection failed'
      }
    };
  }
}

// Register HTTP routes
app.http('browseSharePointSites', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/sites',
  handler: browseSharePointSites
});

app.http('browseSharePointDrives', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/drives',
  handler: browseSharePointDrives
});

app.http('testSharePointConnection', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/test-connection',
  handler: testSharePointConnection
});