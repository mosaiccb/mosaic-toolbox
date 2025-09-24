import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from '../services/TenantDatabaseService';
import { SharePointService } from '../services/SharePointService';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Initialize the database service
const dbService = new TenantDatabaseService();

export interface SharePointConfiguration {
  id: number;
  tenantId: string;
  name: string;
  description?: string;
  tenantDomain: string;
  clientId: string;
  keyVaultSecretName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface SharePointSite {
  id: number;
  sharePointConfigId: number;
  siteId: string;
  siteName: string;
  siteUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharePointLibrary {
  id: number;
  sharePointSiteId: number;
  libraryId: string;
  libraryName: string;
  libraryType: string;
  monitorPath?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SharePointTransferJob {
  id: number;
  tenantId: string;
  name: string;
  description?: string;
  sharePointLibraryId: number;
  sftpConfigurationId: number;
  sourcePath?: string;
  destinationPath?: string;
  filePattern?: string;
  transferMode: 'copy' | 'move';
  scheduleExpression?: string;
  isActive: boolean;
  lastRunAt?: Date;
  lastRunStatus?: string;
  lastRunMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// ===== SharePoint Configuration Functions =====

// Get all SharePoint configurations for the authenticated tenant
export async function getSharePointConfigurations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID is required'
        }
      };
    }

    context.log(`Getting SharePoint configurations for tenant: ${tenantId}`);

    const query = `
      SELECT Id, TenantId, Name, Description, TenantDomain, ClientId, KeyVaultSecretName,
             IsActive, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      FROM dbo.SharePointConfigurations
      WHERE TenantId = @tenantId AND IsActive = 1
      ORDER BY Name
    `;

    const configurations = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    const result: SharePointConfiguration[] = configurations.map((row: any) => ({
      id: row.Id,
      tenantId: row.TenantId,
      name: row.Name,
      description: row.Description,
      tenantDomain: row.TenantDomain,
      clientId: row.ClientId,
      keyVaultSecretName: row.KeyVaultSecretName,
      isActive: row.IsActive,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      createdBy: row.CreatedBy,
      updatedBy: row.UpdatedBy
    }));

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
    context.error('Error getting SharePoint configurations:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Get a specific SharePoint configuration by ID
export async function getSharePointConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const configId = request.params.id;

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

    context.log(`Getting SharePoint configuration ${configId} for tenant: ${tenantId}`);

    const query = `
      SELECT Id, TenantId, Name, Description, TenantDomain, ClientId, KeyVaultSecretName,
             IsActive, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      FROM dbo.SharePointConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configurations = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configIdNumber }
    ]);

    if (configurations.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SharePoint configuration not found'
        }
      };
    }

    const row = configurations[0];
    const result: SharePointConfiguration = {
      id: row.Id,
      tenantId: row.TenantId,
      name: row.Name,
      description: row.Description,
      tenantDomain: row.TenantDomain,
      clientId: row.ClientId,
      keyVaultSecretName: row.KeyVaultSecretName,
      isActive: row.IsActive,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      createdBy: row.CreatedBy,
      updatedBy: row.UpdatedBy
    };

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
    context.error('Error getting SharePoint configuration:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Create a new SharePoint configuration
export async function createSharePointConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID is required'
        }
      };
    }

    context.log('Creating SharePoint configuration for tenant:', tenantId);

    const configData = await request.json() as any;
    
    if (!configData.name || !configData.tenantDomain || !configData.clientId || !configData.clientSecret) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Name, tenant domain, client ID, and client secret are required'
        }
      };
    }

    context.log('Creating SharePoint configuration for tenant:', tenantId);

    // Generate Key Vault secret name for client secret
    const configId = `${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const keyVaultSecretName = `sharepoint-${configId}-clientsecret`;

    // Store client secret in Key Vault
    await dbService.storeSharePointClientSecret(tenantId, configId, configData.clientSecret);

    const query = `
      INSERT INTO dbo.SharePointConfigurations (
        TenantId, Name, Description, TenantDomain, ClientId, KeyVaultSecretName,
        IsActive, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      )
      OUTPUT INSERTED.Id
      VALUES (
        @tenantId, @name, @description, @tenantDomain, @clientId, @keyVaultSecretName,
        1, GETUTCDATE(), GETUTCDATE(), @createdBy, @updatedBy
      )
    `;

    const parameters = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'name', type: 'nvarchar', value: configData.name },
      { name: 'description', type: 'nvarchar', value: configData.description || null },
      { name: 'tenantDomain', type: 'nvarchar', value: configData.tenantDomain },
      { name: 'clientId', type: 'nvarchar', value: configData.clientId },
      { name: 'keyVaultSecretName', type: 'nvarchar', value: keyVaultSecretName },
      { name: 'createdBy', type: 'nvarchar', value: 'system' },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ];

    const result = await dbService.executeQueryWithParams(query, parameters);
    const newConfigId = result[0]?.Id;

    return {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        data: { id: newConfigId },
        message: 'SharePoint configuration created successfully'
      }
    };
  } catch (error) {
    context.error('Error creating SharePoint configuration:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Update an existing SharePoint configuration
export async function updateSharePointConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const configId = request.params.id;

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

    const configData = await request.json() as any;
    
    context.log(`Updating SharePoint configuration ${configId} for tenant: ${tenantId}`);

    // Check if configuration exists
    const checkQuery = `
      SELECT Id, KeyVaultSecretName FROM dbo.SharePointConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const checkResult = await dbService.executeQueryWithParams(checkQuery, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configIdNumber }
    ]);

    if (checkResult.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SharePoint configuration not found'
        }
      };
    }

    // Update client secret if provided
    if (configData.clientSecret) {
      const existingConfig = checkResult[0];
      await dbService.updateSharePointClientSecret(tenantId, existingConfig.KeyVaultSecretName, configData.clientSecret);
    }

    // Build dynamic update query
    const updateFields = [];
    const parameters = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configIdNumber },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ];

    if (configData.name) {
      updateFields.push('Name = @name');
      parameters.push({ name: 'name', type: 'nvarchar', value: configData.name });
    }

    if (configData.description !== undefined) {
      updateFields.push('Description = @description');
      parameters.push({ name: 'description', type: 'nvarchar', value: configData.description });
    }

    if (configData.tenantDomain) {
      updateFields.push('TenantDomain = @tenantDomain');
      parameters.push({ name: 'tenantDomain', type: 'nvarchar', value: configData.tenantDomain });
    }

    if (configData.clientId) {
      updateFields.push('ClientId = @clientId');
      parameters.push({ name: 'clientId', type: 'nvarchar', value: configData.clientId });
    }

    if (updateFields.length === 0) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'No valid fields provided for update'
        }
      };
    }

    updateFields.push('UpdatedAt = GETUTCDATE()');

    const query = `
      UPDATE dbo.SharePointConfigurations
      SET ${updateFields.join(', ')}, UpdatedBy = @updatedBy
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    await dbService.executeQueryWithParams(query, parameters);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        message: 'SharePoint configuration updated successfully'
      }
    };
  } catch (error) {
    context.error('Error updating SharePoint configuration:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Delete (soft delete) a SharePoint configuration
export async function deleteSharePointConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const configId = request.params.id;

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

    context.log(`Deleting SharePoint configuration ${configId} for tenant: ${tenantId}`);

    const query = `
      UPDATE dbo.SharePointConfigurations
      SET IsActive = 0, UpdatedAt = GETUTCDATE(), UpdatedBy = @updatedBy
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const parameters = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configIdNumber },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ];

    const result = await dbService.executeQueryWithParams(query, parameters);

    // For UPDATE queries, check the rowsAffected property we added to the result
    const rowsAffected = (result as any).rowsAffected || 0;

    if (rowsAffected === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SharePoint configuration not found'
        }
      };
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        message: 'SharePoint configuration deleted successfully'
      }
    };
  } catch (error) {
    context.error('Error deleting SharePoint configuration:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// ===== SharePoint Sites Functions =====

// Get sites for a SharePoint configuration
export async function getConfigurationSharePointSites(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const configId = request.params.configId;

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

    context.log(`Getting SharePoint sites for configuration ${configId} and tenant: ${tenantId}`);

    const query = `
      SELECT s.Id, s.SharePointConfigId, s.SiteId, s.SiteName, s.SiteUrl,
             s.IsActive, s.CreatedAt, s.UpdatedAt
      FROM dbo.SharePointSites s
      INNER JOIN dbo.SharePointConfigurations c ON s.SharePointConfigId = c.Id
      WHERE c.Id = @configId AND c.TenantId = @tenantId AND s.IsActive = 1 AND c.IsActive = 1
      ORDER BY s.SiteName
    `;

    const sites = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configIdNumber }
    ]);

    const result: SharePointSite[] = sites.map((row: any) => ({
      id: row.Id,
      sharePointConfigId: row.SharePointConfigId,
      siteId: row.SiteId,
      siteName: row.SiteName,
      siteUrl: row.SiteUrl,
      isActive: row.IsActive,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt
    }));

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
    context.error('Error getting SharePoint sites:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Create a SharePoint site in the database
export async function createSharePointSite(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id');
    const configId = request.params.configId;

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

    const siteData = await request.json() as any;
    
    if (!siteData.siteId || !siteData.siteName || !siteData.siteUrl) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Site ID, Site Name, and Site URL are required'
        }
      };
    }

    context.log(`Creating SharePoint site for configuration ${configId} and tenant: ${tenantId}`);

    // Verify the configuration exists and belongs to the tenant
    const configQuery = `
      SELECT Id FROM dbo.SharePointConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configResult = await dbService.executeQueryWithParams(configQuery, [
      { name: 'configId', type: 'int', value: configIdNumber },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (configResult.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SharePoint configuration not found'
        }
      };
    }

    // Insert the SharePoint site
    const insertQuery = `
      INSERT INTO dbo.SharePointSites (
        SharePointConfigId, SiteId, SiteName, SiteUrl, IsActive, CreatedAt, UpdatedAt
      )
      OUTPUT INSERTED.Id
      VALUES (
        @configId, @siteId, @siteName, @siteUrl, 1, GETUTCDATE(), GETUTCDATE()
      )
    `;

    const parameters = [
      { name: 'configId', type: 'int', value: configIdNumber },
      { name: 'siteId', type: 'nvarchar', value: siteData.siteId },
      { name: 'siteName', type: 'nvarchar', value: siteData.siteName },
      { name: 'siteUrl', type: 'nvarchar', value: siteData.siteUrl }
    ];

    const result = await dbService.executeQueryWithParams(insertQuery, parameters);
    const newSiteId = result[0]?.Id;

    return {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        data: { id: newSiteId },
        message: 'SharePoint site created successfully'
      }
    };
  } catch (error) {
    context.error('Error creating SharePoint site:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// ===== SharePoint Libraries Functions =====

// Get libraries for a SharePoint site
export async function getSharePointLibraries(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const siteId = request.params.siteId;

    if (!tenantId || !siteId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Tenant ID and Site ID are required'
        }
      };
    }

    const siteIdNumber = parseInt(siteId, 10);
    if (isNaN(siteIdNumber)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Invalid site ID'
        }
      };
    }

    context.log(`Getting SharePoint libraries for site ${siteId} and tenant: ${tenantId}`);

    const query = `
      SELECT l.Id, l.SharePointSiteId, l.LibraryId, l.LibraryName, l.LibraryType,
             l.MonitorPath, l.IsActive, l.CreatedAt, l.UpdatedAt
      FROM dbo.SharePointLibraries l
      INNER JOIN dbo.SharePointSites s ON l.SharePointSiteId = s.Id
      INNER JOIN dbo.SharePointConfigurations c ON s.SharePointConfigId = c.Id
      WHERE s.Id = @siteId AND c.TenantId = @tenantId AND l.IsActive = 1 AND s.IsActive = 1 AND c.IsActive = 1
      ORDER BY l.LibraryName
    `;

    const libraries = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'siteId', type: 'int', value: siteIdNumber }
    ]);

    const result: SharePointLibrary[] = libraries.map((row: any) => ({
      id: row.Id,
      sharePointSiteId: row.SharePointSiteId,
      libraryId: row.LibraryId,
      libraryName: row.LibraryName,
      libraryType: row.LibraryType,
      monitorPath: row.MonitorPath,
      isActive: row.IsActive,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt
    }));

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
    context.error('Error getting SharePoint libraries:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Internal server error'
      }
    };
  }
}

// Get all lists and libraries for a specific site
export async function getAllSharePointLists(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configId = request.query.get('configId');
    const siteId = request.query.get('siteId');

    if (!configId || !siteId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Missing configId or siteId parameter'
        }
      };
    }

    // Get SharePoint configuration
    const configQuery = `
      SELECT ClientId, TenantDomain, KeyVaultSecretName 
      FROM dbo.SharePointConfigurations 
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configParams = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: parseInt(configId) }
    ];

    const configResults = await dbService.executeQueryWithParams(configQuery, configParams);
    
    if (!configResults || configResults.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SharePoint configuration not found'
        }
      };
    }

    const config = configResults[0];
    
    // Get client secret from Key Vault
    const clientSecret = await dbService.getSecretByName(config.KeyVaultSecretName);
    
    if (!clientSecret) {
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Failed to retrieve client secret from Key Vault'
        }
      };
    }

    // Create SharePoint service
    const sharePointService = new SharePointService(context, {
      clientId: config.ClientId,
      clientSecret: clientSecret,
      tenantId: tenantId // Use the actual tenant ID from the request header
    });

    // Get all lists and libraries from the site
    const lists = await sharePointService.getAllLists(siteId);
    
    context.log(`📋 Retrieved ${lists.length} SharePoint lists/libraries for site ${siteId}`);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: lists
      }
    };

  } catch (error) {
    context.error('Error getting SharePoint lists:', error);
    
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to get SharePoint lists',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

// Get all available SharePoint sites in the tenant
export async function getAllSharePointSites(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configId = request.query.get('configId');

    if (!configId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Missing configId parameter'
        }
      };
    }

    // Get SharePoint configuration
    const configQuery = `
      SELECT ClientId, TenantDomain, KeyVaultSecretName 
      FROM dbo.SharePointConfigurations 
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configParams = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: parseInt(configId) }
    ];

    const configResults = await dbService.executeQueryWithParams(configQuery, configParams);
    
    if (!configResults || configResults.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SharePoint configuration not found'
        }
      };
    }

    const config = configResults[0];
    
    // Get client secret from Key Vault
    const clientSecret = await dbService.getSecretByName(config.KeyVaultSecretName);
    
    if (!clientSecret) {
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Failed to retrieve client secret from Key Vault'
        }
      };
    }

    // Create SharePoint service
    const sharePointService = new SharePointService(context, {
      clientId: config.ClientId,
      clientSecret: clientSecret,
      tenantId: tenantId // Use the actual tenant ID from the request header
    });

    // Get all sites in the tenant
    const sites = await sharePointService.getSites();
    
    context.log(`📋 Retrieved ${sites.length} SharePoint sites`);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: sites
      }
    };

  } catch (error) {
    context.error('Error getting all SharePoint sites:', error);
    
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to get SharePoint sites',
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

// Browse SharePoint drives for a configuration and site
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
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configId = request.query.get('configId');
    const siteId = request.query.get('siteId');

    if (!configId || !siteId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Missing configId or siteId parameter'
        }
      };
    }

    // Get SharePoint configuration
    const configQuery = `
      SELECT ClientId, TenantDomain, KeyVaultSecretName 
      FROM dbo.SharePointConfigurations 
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configParams = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: parseInt(configId) }
    ];

    const configResults = await dbService.executeQueryWithParams(configQuery, configParams);
    
    if (!configResults || configResults.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SharePoint configuration not found'
        }
      };
    }

    const config = configResults[0];
    
    // Get client secret from Key Vault
    const clientSecret = await dbService.getSecretByName(config.KeyVaultSecretName);
    
    if (!clientSecret) {
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Failed to retrieve client secret from Key Vault'
        }
      };
    }

    // Create SharePoint service
    const sharePointConfig = {
      tenantId: tenantId, // Use the actual tenant ID from the request header
      clientId: config.ClientId,
      clientSecret: clientSecret
    };

    const sharePointService = new SharePointService(context, sharePointConfig);
    const drives = await sharePointService.getDrives(siteId);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: drives
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
        error: 'Failed to browse SharePoint drives',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Browse SharePoint items for a configuration, site, and drive
export async function browseSharePointItems(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configId = request.query.get('configId');
    const siteId = request.query.get('siteId');
    const driveId = request.query.get('driveId');
    const itemId = request.query.get('itemId'); // Optional - for browsing subfolders

    if (!configId || !siteId || !driveId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Missing required parameters: configId, siteId, driveId'
        }
      };
    }

    // Get SharePoint configuration
    const configQuery = `
      SELECT ClientId, TenantDomain, KeyVaultSecretName 
      FROM dbo.SharePointConfigurations 
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configParams = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: parseInt(configId) }
    ];

    const configResults = await dbService.executeQueryWithParams(configQuery, configParams);
    
    if (!configResults || configResults.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SharePoint configuration not found'
        }
      };
    }

    const config = configResults[0];
    
    // Get client secret from Key Vault
    const clientSecret = await dbService.getSecretByName(config.KeyVaultSecretName);
    
    if (!clientSecret) {
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Failed to retrieve client secret from Key Vault'
        }
      };
    }

    // Create SharePoint service
    const sharePointConfig = {
      tenantId: tenantId, // Use the actual tenant ID from the request header
      clientId: config.ClientId,
      clientSecret: clientSecret
    };

    const sharePointService = new SharePointService(context, sharePointConfig);
    
    context.log(`🔍 Browsing SharePoint items:`);
    context.log(`  - Config ID: ${configId}`);
    context.log(`  - Site ID: ${siteId}`);
    context.log(`  - Drive ID: ${driveId}`);
    context.log(`  - Item ID: ${itemId || 'root'}`);
    
    const items = await sharePointService.getItems(driveId, itemId || 'root');
    
    context.log(`📁 Found ${items.length} items in drive/folder`);
    items.forEach((item, index) => {
      context.log(`  ${index + 1}. ${item.name} ${item.isFolder ? '(Folder)' : '(File)'}`);
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: items
      }
    };

  } catch (error) {
    context.error('Error browsing SharePoint items:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to browse SharePoint items',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Test SharePoint Connection Handler
 */
async function testSharePointConnection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      }
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Missing x-tenant-id header'
        }
      };
    }

    const requestBody = await request.json() as any;
    const { tenantDomain, clientId, clientSecret } = requestBody;

    if (!tenantDomain || !clientId || !clientSecret) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Missing required fields: tenantDomain, clientId, clientSecret'
        }
      };
    }

    // Create SharePoint service with provided credentials
    const sharePointConfig = {
      tenantId: tenantId,
      clientId: clientId,
      clientSecret: clientSecret
    };

    const sharePointService = new SharePointService(context, sharePointConfig);
    
    // Test connection by fetching sites
    const sites = await sharePointService.getSites();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: sites
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
        error: error instanceof Error ? error.message : 'Failed to test SharePoint connection'
      }
    };
  }
}

// Register HTTP routes
// Update the getSftpDestinations function to filter by delivery flag
app.http('getSftpDestinations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/destinations',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      if (request.method === 'OPTIONS') {
        return {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id'
          }
        };
      }

      const tenantId = request.headers.get('x-tenant-id');
      if (!tenantId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing x-tenant-id header',
            message: 'Please provide tenant ID in request headers'
          }
        };
      }

      const scope = (request.query.get('scope') || '').toLowerCase();
      const deliveryOnly = request.query.get('deliveryOnly') === 'true'; // New parameter for delivery filtering
      const zeroGuid = '00000000-0000-0000-0000-000000000000';
      let sftpQuery = '';
      let sftpParams: Array<{ name: string; type: string; value: any }> = [];

      // Build base SELECT with delivery flag
      const baseSelect = `
        SELECT Id, Name, Host, Port, Username, RemotePath, IsActive, IsSharePointDeliveryDestination
        FROM dbo.SftpConfigurations 
      `;

      // Build WHERE conditions
      const conditions = ['IsActive = 1'];
      
      if (deliveryOnly) {
        conditions.push('IsSharePointDeliveryDestination = 1');
        context.log(`📋 Getting SharePoint delivery SFTP destinations only`);
      }

      if (scope === 'all') {
        context.log(`📋 Getting SFTP destinations with scope=all${deliveryOnly ? ' (delivery only)' : ''}`);
        sftpQuery = `${baseSelect} WHERE ${conditions.join(' AND ')} ORDER BY Name`;
      } else if (scope === 'tenant+global') {
        conditions.push('(TenantId = @tenantId OR TenantId = @zeroGuid)');
        context.log(`📋 Getting SFTP destinations for tenant ${tenantId} with scope=tenant+global${deliveryOnly ? ' (delivery only)' : ''}`);
        sftpQuery = `${baseSelect} WHERE ${conditions.join(' AND ')} ORDER BY Name`;
        sftpParams = [
          { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
          { name: 'zeroGuid', type: 'uniqueidentifier', value: zeroGuid }
        ];
      } else {
        conditions.push('TenantId = @tenantId');
        context.log(`📋 Getting SFTP destinations for tenant ${tenantId} with scope=tenant${deliveryOnly ? ' (delivery only)' : ''}`);
        sftpQuery = `${baseSelect} WHERE ${conditions.join(' AND ')} ORDER BY Name`;
        sftpParams = [
          { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
        ];
      }

      const sftpResults = await dbService.executeQueryWithParams(sftpQuery, sftpParams);
      
      const destinations = sftpResults.map((row: any) => ({
        id: row.Id,
        name: row.Name,
        host: row.Host,
        port: row.Port,
        username: row.Username,
        remotePath: row.RemotePath || '/',
        isSharePointDeliveryDestination: row.IsSharePointDeliveryDestination,
        displayName: `${row.Name} (${row.Host})${row.IsSharePointDeliveryDestination ? ' [📤 Delivery]' : ''}`
      }));

      context.log(`✅ Found ${destinations.length} SFTP destinations${deliveryOnly ? ' (delivery-enabled)' : ''}`);

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: true,
          data: destinations,
          meta: {
            total: destinations.length,
            deliveryOnly: deliveryOnly,
            scope: scope || 'tenant'
          }
        }
      };
      
    } catch (error: any) {
      context.error('❌ Error getting SFTP destinations:', error);
      
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Failed to get SFTP destinations',
          message: error.message || 'An unknown error occurred',
          details: error.stack
        }
      };
    }
  }
});

app.http('getSharePointConfigurations', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/configurations/list',
  handler: getSharePointConfigurations
});

app.http('getSharePointConfiguration', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/configurations/get/{id}',
  handler: getSharePointConfiguration
});

app.http('createSharePointConfiguration', {
  methods: ['POST', 'OPTIONS'],
  route: 'sharepoint/configurations',
  handler: createSharePointConfiguration
});

app.http('updateSharePointConfiguration', {
  methods: ['PUT', 'OPTIONS'],
  route: 'sharepoint/configurations/update/{id}',
  handler: updateSharePointConfiguration
});

app.http('deleteSharePointConfiguration', {
  methods: ['DELETE', 'OPTIONS'],
  route: 'sharepoint/configurations/delete/{id}',
  handler: deleteSharePointConfiguration
});

app.http('getConfigurationSharePointSites', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/configurations/{configId}/sites/list',
  handler: getConfigurationSharePointSites
});

app.http('createSharePointSite', {
  methods: ['POST', 'OPTIONS'],
  route: 'sharepoint/configurations/{configId}/sites',
  handler: createSharePointSite
});

app.http('getSharePointLibraries', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/sites/{siteId}/libraries',
  handler: getSharePointLibraries
});

app.http('getAllSharePointSites', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/sites/all',
  handler: getAllSharePointSites
});

app.http('getAllSharePointLists', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/lists/all',
  handler: getAllSharePointLists
});

app.http('browseConfigSharePointDrives', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/drives',
  handler: browseSharePointDrives
});

app.http('browseConfigSharePointItems', {
  methods: ['GET', 'OPTIONS'],
  route: 'sharepoint/items',
  handler: browseSharePointItems
});

app.http('testSharePointConnection', {
  methods: ['POST', 'OPTIONS'],
  route: 'sharepoint/test-connection',
  handler: testSharePointConnection
});

// Get SharePoint items using drive-based approach
app.http('getSharePointItemsByDrive', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sharepoint/drive-items',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      if (request.method === 'OPTIONS') {
        return {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id'
          }
        };
      }

      const tenantId = request.headers.get('x-tenant-id');
      if (!tenantId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing x-tenant-id header',
            message: 'Please provide tenant ID in request headers'
          }
        };
      }

      const configId = request.query.get('configId');
      const driveId = request.query.get('driveId');
      const folderPath = request.query.get('folderPath') || '';
      
      if (!configId || !driveId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing required parameters',
            message: 'Please provide configId and driveId in query parameters'
          }
        };
      }

      // Get SharePoint configuration
      const configQuery = `
        SELECT ClientId, TenantDomain, KeyVaultSecretName 
        FROM dbo.SharePointConfigurations 
        WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
      `;

      const configParams = [
        { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
        { name: 'configId', type: 'int', value: parseInt(configId) }
      ];

      const configResults = await dbService.executeQueryWithParams(configQuery, configParams);
      
      if (!configResults || configResults.length === 0) {
        return {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'SharePoint configuration not found'
          }
        };
      }

      const config = configResults[0];
      
      // Get client secret from Key Vault
      const clientSecret = await dbService.getSecretByName(config.KeyVaultSecretName);
      
      if (!clientSecret) {
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'Failed to retrieve client secret from Key Vault'
          }
        };
      }

      // Create SharePoint service
      const sharePointConfig = {
        tenantId: tenantId,
        clientId: config.ClientId,
        clientSecret: clientSecret
      };

      const sharePointService = new SharePointService(context, sharePointConfig);
      
      // Get drive items using the recommended approach
      const items = await sharePointService.getItemsByDriveId(driveId, folderPath, context);
      
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: true,
          data: items,
          message: `Retrieved ${items.length} items from drive ${driveId}${folderPath ? ` in folder ${folderPath}` : ' (root)'}`
        }
      };

    } catch (error: any) {
      context.error('Error getting drive items:', error);
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: { 
          error: 'Internal server error',
          message: error.message || 'Failed to get drive items',
          details: error.stack,
          status: error.status || 'Unknown'
        }
      };
    }
  }
});

// Get SharePoint Site Pages for a site
app.http('getSharePointSitePages', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sharepoint/pages',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      if (request.method === 'OPTIONS') {
        return {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id'
          }
        };
      }

      const tenantId = request.headers.get('x-tenant-id');
      if (!tenantId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing x-tenant-id header',
            message: 'Please provide tenant ID in request headers'
          }
        };
      }

      const configId = request.query.get('configId');
      const siteId = request.query.get('siteId');
      
      if (!configId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing configId parameter',
            message: 'Please provide configId in query parameters'
          }
        };
      }

      if (!siteId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing siteId parameter',
            message: 'Please provide siteId in query parameters'
          }
        };
      }

      // Get SharePoint configuration
      
      const configQuery = `
        SELECT ClientId, TenantDomain, KeyVaultSecretName 
        FROM dbo.SharePointConfigurations 
        WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
      `;

      const configParams = [
        { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
        { name: 'configId', type: 'int', value: parseInt(configId) }
      ];

      const configResults = await dbService.executeQueryWithParams(configQuery, configParams);
      
      if (!configResults || configResults.length === 0) {
        return {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'SharePoint configuration not found'
          }
        };
      }

      const config = configResults[0];
      
      // Get client secret from Key Vault
      const clientSecret = await dbService.getSecretByName(config.KeyVaultSecretName);
      
      if (!clientSecret) {
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'Failed to retrieve client secret from Key Vault'
          }
        };
      }

      // Create SharePoint service
      const sharePointConfig = {
        tenantId: tenantId,
        clientId: config.ClientId,
        clientSecret: clientSecret
      };

      const sharePointService = new SharePointService(context, sharePointConfig);
      
      // Get Site Pages
      const pages = await sharePointService.getSitePages(siteId, context);
      
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: true,
          data: pages,
          message: `Retrieved ${pages.length} pages for site ${siteId}`
        }
      };

    } catch (error: any) {
      context.error('Error getting SharePoint Site Pages:', error);
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: { 
          error: 'Internal server error',
          message: error.message || 'Failed to get SharePoint Site Pages',
          details: error.stack,
          status: error.status || 'Unknown'
        }
      };
    }
  }
});

// Download SharePoint file
app.http('downloadSharePointFileConfig', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sharepoint/download',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      if (request.method === 'OPTIONS') {
        return {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id'
          }
        };
      }

      const tenantId = request.headers.get('x-tenant-id');
      if (!tenantId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing x-tenant-id header',
            message: 'Please provide tenant ID in request headers'
          }
        };
      }

      const configId = request.query.get('configId');
      const siteId = request.query.get('siteId');
      const driveId = request.query.get('driveId');
      const itemId = request.query.get('itemId');
      
      if (!configId || !siteId || !driveId || !itemId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing required parameters',
            message: 'Please provide configId, siteId, driveId, and itemId in query parameters'
          }
        };
      }

      context.log(`📥 Download request for drive ${driveId}, item ${itemId}`);

      // Get SharePoint configuration
      const configQuery = `
        SELECT ClientId, TenantDomain, KeyVaultSecretName 
        FROM dbo.SharePointConfigurations 
        WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
      `;

      const configParams = [
        { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
        { name: 'configId', type: 'int', value: parseInt(configId) }
      ];

      const configResults = await dbService.executeQueryWithParams(configQuery, configParams);
      
      if (!configResults || configResults.length === 0) {
        return {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'SharePoint configuration not found'
          }
        };
      }

      const config = configResults[0];
      
      // Get client secret from Key Vault
      const clientSecret = await dbService.getSecretByName(config.KeyVaultSecretName);
      if (!clientSecret) {
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'Failed to retrieve client secret from Key Vault'
          }
        };
      }
      
      // Initialize SharePoint service
      const sharePointConfig = {
        tenantId: tenantId,
        clientId: config.ClientId,
        clientSecret: clientSecret
      };

      const sharePointService = new SharePointService(context, sharePointConfig);

      // Download the file
      const fileBuffer = await sharePointService.downloadFile(driveId, itemId);

      context.log(`✅ File downloaded successfully: ${fileBuffer.length} bytes`);

      // Return the file as response
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
          'Content-Disposition': 'attachment'
        },
        body: fileBuffer
      };
      
    } catch (error: any) {
      context.error('❌ Error downloading SharePoint file:', error);
      
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Failed to download SharePoint file',
          message: error.message || 'An unknown error occurred',
          details: error.stack,
          status: error.status || 'Unknown'
        }
      };
    }
  }
});

// Transfer SharePoint file to SFTP
app.http('transferSharePointFileToSftp', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sharepoint/transfer-to-sftp',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      if (request.method === 'OPTIONS') {
        return {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id'
          }
        };
      }

      const tenantId = request.headers.get('x-tenant-id');
      if (!tenantId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing x-tenant-id header',
            message: 'Please provide tenant ID in request headers'
          }
        };
      }

      const requestBody = await request.json() as any;
      const { configId, siteId, driveId, itemId, fileName, sftpDestinationId } = requestBody;
      
      if (!configId || !siteId || !driveId || !itemId || !fileName || !sftpDestinationId) {
        return {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'Missing required parameters',
            message: 'Please provide configId, siteId, driveId, itemId, fileName, and sftpDestinationId'
          }
        };
      }

      context.log(`🚀 SFTP transfer request: ${fileName} from drive ${driveId} to SFTP destination ${sftpDestinationId}`);

      // Get SharePoint configuration
      const configQuery = `
        SELECT ClientId, TenantDomain, KeyVaultSecretName 
        FROM dbo.SharePointConfigurations 
        WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
      `;

      const configParams = [
        { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
        { name: 'configId', type: 'int', value: parseInt(configId) }
      ];

      const configResults = await dbService.executeQueryWithParams(configQuery, configParams);
      
      if (!configResults || configResults.length === 0) {
        return {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'SharePoint configuration not found'
          }
        };
      }

      const config = configResults[0];

      // Get SFTP destination configuration
      const sftpQuery = `
        SELECT Id, Name, Host, Port, Username, KeyVaultSecretName, RemotePath, IsActive
        FROM dbo.SftpConfigurations 
        WHERE Id = @sftpDestinationId AND TenantId = @tenantId AND IsActive = 1
      `;

      const sftpParams = [
        { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
        { name: 'sftpDestinationId', type: 'int', value: parseInt(sftpDestinationId) }
      ];

      const sftpResults = await dbService.executeQueryWithParams(sftpQuery, sftpParams);
      
      if (!sftpResults || sftpResults.length === 0) {
        return {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'SFTP destination configuration not found'
          }
        };
      }

      const sftpConfig = sftpResults[0];

      // Get client secret from Key Vault for SharePoint
      const clientSecret = await dbService.getSecretByName(config.KeyVaultSecretName);
      if (!clientSecret) {
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'Failed to retrieve SharePoint client secret from Key Vault'
          }
        };
      }

      // Get SFTP password from Key Vault
      const sftpPassword = await dbService.getSecretByName(sftpConfig.KeyVaultSecretName);
      if (!sftpPassword) {
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: {
            success: false,
            error: 'Failed to retrieve SFTP password from Key Vault'
          }
        };
      }
      
      // Initialize SharePoint service and download file
      const sharePointConfig = {
        tenantId: tenantId,
        clientId: config.ClientId,
        clientSecret: clientSecret
      };

      const sharePointService = new SharePointService(context, sharePointConfig);
      
      context.log(`📥 Downloading file from SharePoint...`);
      const fileBuffer = await sharePointService.downloadFile(driveId, itemId);

      context.log(`📤 Uploading file to SFTP: ${sftpConfig.Host}`);
      
      // Initialize SFTP service
      const { SftpService } = await import('../services/SftpService');
      const sftpService = new SftpService();
      
      // Create temporary file from buffer
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `sharepoint_${Date.now()}_${fileName}`);
      const remotePath = `${sftpConfig.RemotePath}/${fileName}`;
      
      fs.writeFileSync(tempFilePath, fileBuffer);
      
      try {
        // Create SFTP configuration for connection
        const sftpConnectConfig = {
          id: sftpConfig.Id,
          tenantId: tenantId,
          name: sftpConfig.Name,
          host: sftpConfig.Host,
          port: sftpConfig.Port,
          username: sftpConfig.Username,
          authMethod: 'password',
          keyVaultSecretName: sftpConfig.KeyVaultSecretName,
          remotePath: sftpConfig.RemotePath,
          isActive: true
        };

        // Create SFTP connection
        const connection = await sftpService.connect(sftpConnectConfig);
        
        // Upload file using existing uploadFile method
        await sftpService.uploadFile(connection, tempFilePath, remotePath);
        
        // Close connection
        connection.end();
        
      } finally {
        // Clean up temporary file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }

      context.log(`✅ File transfer completed: ${fileName} → ${sftpConfig.Host}${remotePath}`);

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: true,
          message: `File successfully transferred to ${sftpConfig.Name}`,
          details: {
            fileName: fileName,
            sftpDestination: sftpConfig.Name,
            remotePath: remotePath,
            fileSize: fileBuffer.length
          }
        }
      };
      
    } catch (error: any) {
      context.error('❌ Error transferring SharePoint file to SFTP:', error);
      
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Failed to transfer SharePoint file to SFTP',
          message: error.message || 'An unknown error occurred',
          details: error.stack,
          status: error.status || 'Unknown'
        }
      };
    }
  }
});