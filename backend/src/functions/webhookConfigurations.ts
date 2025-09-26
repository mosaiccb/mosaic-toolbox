import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TenantDatabaseService } from "../services/TenantDatabaseService";
import * as crypto from 'crypto';

const dbService = new TenantDatabaseService();

export interface CreateWebhookConfigurationRequest {
  name: string;
  description?: string;
  endpointPath: string;
  secretKey?: string;
  allowedSources?: string[];
  webhookType: string;
  configurationJson?: string;
}

export interface UpdateWebhookConfigurationRequest {
  name?: string;
  description?: string;
  allowedSources?: string[];
  webhookType?: string;
  configurationJson?: string;
  isActive?: boolean;
  regenerateSecret?: boolean;
}

// Get all webhook configurations
export async function getWebhookConfigurations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`getWebhookConfigurations called with method: ${request.method}`);

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
    context.log('Getting webhook configurations for tenant:', tenantId);

    const query = `
      SELECT Id, TenantId, Name, Description, EndpointPath, IsActive, AllowedSources,
             WebhookType, ConfigurationJson, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      FROM dbo.WebhookConfigurations 
      WHERE TenantId = @tenantId AND IsActive = 1
      ORDER BY Name
    `;

    const configurations = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    const result = configurations.map((row: any) => ({
      id: row.Id,
      tenantId: row.TenantId,
      name: row.Name,
      description: row.Description,
      endpointPath: row.EndpointPath,
      isActive: row.IsActive,
      allowedSources: row.AllowedSources ? JSON.parse(row.AllowedSources) : [],
      webhookType: row.WebhookType,
      configurationJson: row.ConfigurationJson,
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
        data: result,
        count: result.length
      }
    };

  } catch (error) {
    context.error('Error getting webhook configurations:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to retrieve webhook configurations',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Get single webhook configuration
export async function getWebhookConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`getWebhookConfiguration called with method: ${request.method}`);

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
    const configId = parseInt(request.params.id || '0');

    if (isNaN(configId)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Invalid webhook configuration ID' }
      };
    }

    const query = `
      SELECT Id, TenantId, Name, Description, EndpointPath, IsActive, AllowedSources,
             WebhookType, ConfigurationJson, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      FROM dbo.WebhookConfigurations 
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const result = await dbService.executeQueryWithParams(query, [
      { name: 'configId', type: 'int', value: configId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (result.length === 0) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Webhook configuration not found' }
      };
    }

    const row = result[0];
    const configuration = {
      id: row.Id,
      tenantId: row.TenantId,
      name: row.Name,
      description: row.Description,
      endpointPath: row.EndpointPath,
      isActive: row.IsActive,
      allowedSources: row.AllowedSources ? JSON.parse(row.AllowedSources) : [],
      webhookType: row.WebhookType,
      configurationJson: row.ConfigurationJson,
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
        data: configuration
      }
    };

  } catch (error) {
    context.error('Error getting webhook configuration:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to retrieve webhook configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Create webhook configuration
export async function createWebhookConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`createWebhookConfiguration called with method: ${request.method}`);

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
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configData = await request.json() as CreateWebhookConfigurationRequest;

    // Validate required fields
    if (!configData.name || !configData.endpointPath || !configData.webhookType) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          success: false,
          error: 'Missing required fields: name, endpointPath, and webhookType are required'
        }
      };
    }

    // Normalize endpoint path
    let endpointPath = configData.endpointPath;
    if (!endpointPath.startsWith('/webhooks/endpoint/')) {
      endpointPath = `/webhooks/endpoint/${endpointPath.replace(/^\/+/, '')}`;
    }

    // Generate secret key if not provided
    const secretKey = configData.secretKey || generateSecretKey();

    // Check for duplicate endpoint path
    const duplicateCheck = `
      SELECT COUNT(*) as Count 
      FROM dbo.WebhookConfigurations 
      WHERE TenantId = @tenantId AND EndpointPath = @endpointPath AND IsActive = 1
    `;

    const duplicateResult = await dbService.executeQueryWithParams(duplicateCheck, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'endpointPath', type: 'nvarchar', value: endpointPath }
    ]);

    if (duplicateResult[0].Count > 0) {
      return {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          success: false,
          error: `Webhook endpoint path '${endpointPath}' already exists for this tenant`
        }
      };
    }

    const query = `
      INSERT INTO dbo.WebhookConfigurations (
        TenantId, Name, Description, EndpointPath, SecretKey, IsActive,
        AllowedSources, WebhookType, ConfigurationJson, CreatedBy, UpdatedBy
      ) VALUES (
        @tenantId, @name, @description, @endpointPath, @secretKey, 1,
        @allowedSources, @webhookType, @configurationJson, @createdBy, @updatedBy
      );
      SELECT SCOPE_IDENTITY() as Id;
    `;

    const result = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'name', type: 'nvarchar', value: configData.name },
      { name: 'description', type: 'nvarchar', value: configData.description || null },
      { name: 'endpointPath', type: 'nvarchar', value: endpointPath },
      { name: 'secretKey', type: 'nvarchar', value: secretKey },
      { name: 'allowedSources', type: 'nvarchar', value: configData.allowedSources ? JSON.stringify(configData.allowedSources) : null },
      { name: 'webhookType', type: 'nvarchar', value: configData.webhookType },
      { name: 'configurationJson', type: 'nvarchar', value: configData.configurationJson || null },
      { name: 'createdBy', type: 'nvarchar', value: 'system' },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ]);

    return {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        message: 'Webhook configuration created successfully',
        id: result[0].Id,
        endpointPath: endpointPath,
        secretKey: secretKey // Return secret key only on creation
      }
    };

  } catch (error) {
    context.error('Error creating webhook configuration:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to create webhook configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Update webhook configuration
export async function updateWebhookConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`updateWebhookConfiguration called with method: ${request.method}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configId = parseInt(request.params.id || '0');
    const configData = await request.json() as UpdateWebhookConfigurationRequest;

    if (isNaN(configId)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Invalid webhook configuration ID' }
      };
    }

    // Check if configuration exists
    const existsQuery = `
      SELECT Id FROM dbo.WebhookConfigurations 
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const existsResult = await dbService.executeQueryWithParams(existsQuery, [
      { name: 'configId', type: 'int', value: configId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (existsResult.length === 0) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Webhook configuration not found' }
      };
    }

    // Build dynamic update query
    const updateFields = [];
    const parameters: Array<{name: string, type: string, value: any}> = [
      { name: 'configId', type: 'int', value: configId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ];

    if (configData.name !== undefined) {
      updateFields.push('Name = @name');
      parameters.push({ name: 'name', type: 'nvarchar', value: configData.name });
    }
    if (configData.description !== undefined) {
      updateFields.push('Description = @description');
      parameters.push({ name: 'description', type: 'nvarchar', value: configData.description });
    }
    if (configData.allowedSources !== undefined) {
      updateFields.push('AllowedSources = @allowedSources');
      parameters.push({ name: 'allowedSources', type: 'nvarchar', value: configData.allowedSources ? JSON.stringify(configData.allowedSources) : null });
    }
    if (configData.webhookType !== undefined) {
      updateFields.push('WebhookType = @webhookType');
      parameters.push({ name: 'webhookType', type: 'nvarchar', value: configData.webhookType });
    }
    if (configData.configurationJson !== undefined) {
      updateFields.push('ConfigurationJson = @configurationJson');
      parameters.push({ name: 'configurationJson', type: 'nvarchar', value: configData.configurationJson });
    }
    if (configData.isActive !== undefined) {
      updateFields.push('IsActive = @isActive');
      parameters.push({ name: 'isActive', type: 'bit', value: configData.isActive });
    }

    // Generate new secret key if requested
    if (configData.regenerateSecret === true) {
      const newSecretKey = generateSecretKey();
      updateFields.push('SecretKey = @secretKey');
      parameters.push({ name: 'secretKey', type: 'nvarchar', value: newSecretKey });
    }

    if (updateFields.length === 0) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'No fields to update' }
      };
    }

    updateFields.push('UpdatedAt = GETUTCDATE()');
    updateFields.push('UpdatedBy = @updatedBy');
    parameters.push({ name: 'updatedBy', type: 'nvarchar', value: 'system' });

    const updateQuery = `
      UPDATE dbo.WebhookConfigurations 
      SET ${updateFields.join(', ')}
      WHERE Id = @configId AND TenantId = @tenantId
    `;

    await dbService.executeQueryWithParams(updateQuery, parameters);

    const responseData: any = {
      success: true,
      message: 'Webhook configuration updated successfully'
    };

    // Include new secret key if it was regenerated
    if (configData.regenerateSecret === true) {
      const secretParam = parameters.find(p => p.name === 'secretKey');
      responseData.newSecretKey = secretParam?.value;
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: responseData
    };

  } catch (error) {
    context.error('Error updating webhook configuration:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to update webhook configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Delete webhook configuration (soft delete)
export async function deleteWebhookConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`deleteWebhookConfiguration called with method: ${request.method}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configId = parseInt(request.params.id || '0');

    if (isNaN(configId)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Invalid webhook configuration ID' }
      };
    }

    const query = `
      UPDATE dbo.WebhookConfigurations 
      SET IsActive = 0, UpdatedAt = GETUTCDATE(), UpdatedBy = @updatedBy
      WHERE Id = @configId AND TenantId = @tenantId
    `;

    await dbService.executeQueryWithParams(query, [
      { name: 'configId', type: 'int', value: configId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ]);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        message: 'Webhook configuration deleted successfully'
      }
    };

  } catch (error) {
    context.error('Error deleting webhook configuration:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to delete webhook configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Generate a secure random secret key
function generateSecretKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Register webhook configuration management endpoints
app.http('webhookConfigsList', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/configs',
  handler: getWebhookConfigurations
});

app.http('listWebhookConfigs', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/configurations',
  handler: getWebhookConfigurations
});

app.http('getWebhookConfig', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/configurations/{id}',
  handler: getWebhookConfiguration
});

app.http('createWebhookConfig', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/configurations',
  handler: createWebhookConfiguration
});

app.http('updateWebhookConfig', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/configurations/{id}',
  handler: updateWebhookConfiguration
});

app.http('deleteWebhookConfig', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/configurations/{id}',
  handler: deleteWebhookConfiguration
});