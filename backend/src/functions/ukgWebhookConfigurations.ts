import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TenantDatabaseService } from "../services/TenantDatabaseService";
import * as crypto from 'crypto';

const dbService = new TenantDatabaseService();

export interface UkgWebhookConfiguration {
  id?: number;
  tenantId: string;
  name: string;
  description?: string;
  endpointPath: string;
  ukgCompanyId: string; // UKG Ready Company ID
  ukgEventTypes: string[]; // ['AccountCreated', 'EmployeeHired', 'PayrollProcessed']
  authMethod: 'basic' | 'bearer' | 'oauth' | 'none';
  authConfig: {
    username?: string;
    password?: string;
    token?: string;
    oauthUrl?: string;
    clientId?: string;
    clientSecret?: string;
  };
  selectedFields: string[]; // Fields to extract from webhook payload
  isActive: boolean;
  testConnectionUrl?: string; // UKG Ready test connection endpoint
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Get all UKG webhook configurations
export async function getUkgWebhookConfigurations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    
    const query = `
      SELECT 
        id, tenantId, name, description, endpointPath, isActive,
        configurationJson, createdAt, updatedAt, createdBy, updatedBy
      FROM WebhookConfigurations 
      WHERE tenantId = @tenantId AND webhookType = 'ukg-ready'
      ORDER BY createdAt DESC
    `;

    const result = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    const configurations = result.map((row: any) => {
      const config = JSON.parse(row.configurationJson || '{}');
      return {
        id: row.id,
        tenantId: row.tenantId,
        name: row.name,
        description: row.description,
        endpointPath: row.endpointPath,
        ukgCompanyId: config.ukgCompanyId || '',
        ukgEventTypes: config.ukgEventTypes || [],
        authMethod: config.authMethod || 'none',
        selectedFields: config.selectedFields || [],
        isActive: row.isActive,
        testConnectionUrl: config.testConnectionUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        webhookUrl: `https://mosaic-toolbox.azurewebsites.net/api/ukg-webhooks/${tenantId}${row.endpointPath}`
      };
    });

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: configurations,
        count: configurations.length
      }
    };

  } catch (error) {
    context.log('Error getting UKG webhook configurations:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
}

// Create new UKG webhook configuration
export async function createUkgWebhookConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const body = await request.json() as any;

    // Validate required fields
    if (!body.name || !body.endpointPath || !body.ukgCompanyId || !body.authMethod) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Missing required fields: name, endpointPath, ukgCompanyId, authMethod'
        }
      };
    }

    // Validate authentication configuration
    const authValidation = validateAuthConfig(body.authMethod, body.authConfig || {});
    if (!authValidation.valid) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: authValidation.error
        }
      };
    }

    // Ensure endpoint path starts with /
    const endpointPath = body.endpointPath.startsWith('/') ? body.endpointPath : `/${body.endpointPath}`;

    // Check if endpoint path already exists for this tenant
    const existingQuery = `
      SELECT id FROM WebhookConfigurations 
      WHERE tenantId = @tenantId AND endpointPath = @endpointPath AND webhookType = 'ukg-ready'
    `;
    
    const existing = await dbService.executeQueryWithParams(existingQuery, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'endpointPath', type: 'nvarchar', value: endpointPath }
    ]);

    if (existing.length > 0) {
      return {
        status: 409,
        jsonBody: {
          success: false,
          error: 'UKG webhook configuration with this endpoint path already exists'
        }
      };
    }

    // Generate secret key for webhook validation (if needed)
    const secretKey = crypto.randomBytes(32).toString('hex');

    // Prepare configuration JSON
    const configurationJson = JSON.stringify({
      ukgCompanyId: body.ukgCompanyId,
      ukgEventTypes: body.ukgEventTypes || [],
      authMethod: body.authMethod,
      authConfig: body.authConfig || {},
      selectedFields: body.selectedFields || [],
      testConnectionUrl: body.testConnectionUrl
    });

    // Insert new configuration
    const insertQuery = `
      INSERT INTO WebhookConfigurations (
        tenantId, name, description, endpointPath, secretKey, isActive,
        webhookType, configurationJson, createdAt, updatedAt, createdBy
      )
      OUTPUT INSERTED.id
      VALUES (
        @tenantId, @name, @description, @endpointPath, @secretKey, @isActive,
        @webhookType, @configurationJson, @createdAt, @updatedAt, @createdBy
      )
    `;

    const result = await dbService.executeQueryWithParams(insertQuery, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'name', type: 'nvarchar', value: body.name },
      { name: 'description', type: 'nvarchar', value: body.description || '' },
      { name: 'endpointPath', type: 'nvarchar', value: endpointPath },
      { name: 'secretKey', type: 'nvarchar', value: secretKey },
      { name: 'isActive', type: 'bit', value: body.isActive !== false },
      { name: 'webhookType', type: 'nvarchar', value: 'ukg-ready' },
      { name: 'configurationJson', type: 'ntext', value: configurationJson },
      { name: 'createdAt', type: 'datetime2', value: new Date() },
      { name: 'updatedAt', type: 'datetime2', value: new Date() },
      { name: 'createdBy', type: 'nvarchar', value: 'system' }
    ]);

    const configurationId = result[0].id;

    return {
      status: 201,
      jsonBody: {
        success: true,
        message: 'UKG webhook configuration created successfully',
        id: configurationId,
        endpointPath,
        secretKey,
        webhookUrl: `https://mosaic-toolbox.azurewebsites.net/api/ukg-webhooks/${tenantId}${endpointPath}`,
        ukgCompanyId: body.ukgCompanyId,
        authMethod: body.authMethod
      }
    };

  } catch (error) {
    context.log('Error creating UKG webhook configuration:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
}

// Test UKG webhook connection
export async function testUkgWebhookConnection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const configId = request.params.id;

    if (!configId) {
      return {
        status: 400,
        jsonBody: { success: false, error: 'Configuration ID is required' }
      };
    }

    // Get configuration
    const query = `
      SELECT * FROM WebhookConfigurations 
      WHERE id = @id AND tenantId = @tenantId AND webhookType = 'ukg-ready'
    `;

    const result = await dbService.executeQueryWithParams(query, [
      { name: 'id', type: 'int', value: parseInt(configId) },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (result.length === 0) {
      return {
        status: 404,
        jsonBody: { success: false, error: 'UKG webhook configuration not found' }
      };
    }

    const config = result[0];
    const configData = JSON.parse(config.configurationJson || '{}');

    // Send test webhook to our own endpoint
    const testPayload = {
      EventType: 'TestConnection',
      CompanyId: configData.ukgCompanyId,
      EventId: `test-${Date.now()}`,
      TestData: {
        message: 'This is a test webhook from UKG Ready integration',
        timestamp: new Date().toISOString(),
        fields: configData.selectedFields
      }
    };

    const webhookUrl = `https://mosaic-toolbox.azurewebsites.net/api/ukg-webhooks/${tenantId}${config.endpointPath}`;
    
    // Prepare authentication headers
    let authHeaders: any = {
      'Content-Type': 'application/json',
      'User-Agent': 'UKG-Ready-Test-Connection/1.0'
    };

    if (configData.authMethod === 'basic' && configData.authConfig.username) {
      const credentials = Buffer.from(`${configData.authConfig.username}:${configData.authConfig.password}`).toString('base64');
      authHeaders.Authorization = `Basic ${credentials}`;
    } else if (configData.authMethod === 'bearer' && configData.authConfig.token) {
      authHeaders.Authorization = `Bearer ${configData.authConfig.token}`;
    } else if (configData.authMethod === 'oauth' && configData.authConfig.token) {
      authHeaders.Authorization = `Bearer ${configData.authConfig.token}`;
    }

    // Send test request
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(testPayload)
    });

    const responseText = await response.text();
    let responseJson: any = {};
    
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { message: responseText };
    }

    return {
      status: 200,
      jsonBody: {
        success: response.ok,
        message: response.ok ? 'Test connection successful' : 'Test connection failed',
        webhookUrl,
        testResponse: {
          status: response.status,
          statusText: response.statusText,
          body: responseJson
        },
        authMethod: configData.authMethod,
        ukgCompanyId: configData.ukgCompanyId
      }
    };

  } catch (error) {
    context.log('Error testing UKG webhook connection:', error);
    return {
      status: 500,
      jsonBody: { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Validate authentication configuration
function validateAuthConfig(authMethod: string, authConfig: any): { valid: boolean; error?: string } {
  switch (authMethod) {
    case 'basic':
      if (!authConfig.username || !authConfig.password) {
        return { valid: false, error: 'Basic authentication requires username and password' };
      }
      break;
    case 'bearer':
      if (!authConfig.token) {
        return { valid: false, error: 'Bearer authentication requires token' };
      }
      break;
    case 'oauth':
      if (!authConfig.oauthUrl || !authConfig.clientId || !authConfig.clientSecret) {
        return { valid: false, error: 'OAuth authentication requires oauthUrl, clientId, and clientSecret' };
      }
      break;
    case 'none':
      // No validation needed
      break;
    default:
      return { valid: false, error: 'Invalid authentication method' };
  }
  
  return { valid: true };
}

// Register UKG webhook configuration management endpoints
app.http('getUkgWebhookConfigurations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'ukg-webhooks/configurations',
  handler: getUkgWebhookConfigurations
});

app.http('createUkgWebhookConfiguration', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'ukg-webhooks/configurations',
  handler: createUkgWebhookConfiguration
});

app.http('testUkgWebhookConnection', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'ukg-webhooks/configurations/{id}/test',
  handler: testUkgWebhookConnection
});