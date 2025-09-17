import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from '../services/TenantDatabaseService';

// Initialize the database service
const dbService = new TenantDatabaseService();

export interface SftpConfiguration {
  id?: number;
  tenantId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  keyVaultSecretName: string;
  password?: string; // For password auth method
  privateKey?: string; // For private key auth method
  remotePath?: string;
  configurationJson?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Get all SFTP configurations for the authenticated tenant
export async function getSftpConfigurations(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    // For now, we'll use a simple tenant ID from headers - in production this should be from authentication
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';

    context.log('Getting SFTP configurations for tenant:', tenantId);

    // Use a simple query to get SFTP configurations
    const query = `
      SELECT Id, TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName,
             RemotePath, ConfigurationJson, IsActive, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      FROM dbo.SftpConfigurations
      WHERE TenantId = @tenantId AND IsActive = 1
      ORDER BY Name
    `;

    const configurations = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    const result: SftpConfiguration[] = configurations.map((row: any) => ({
      id: row.Id,
      tenantId: row.TenantId,
      name: row.Name,
      host: row.Host,
      port: row.Port,
      username: row.Username,
      authMethod: row.AuthMethod,
      keyVaultSecretName: row.KeyVaultSecretName,
      remotePath: row.RemotePath,
      configurationJson: row.ConfigurationJson,
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        data: result,
        count: result.length
      }
    };
  } catch (error) {
    context.error('Error getting SFTP configurations:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to retrieve SFTP configurations',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Get a specific SFTP configuration by ID
export async function getSftpConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    context.log(`Getting SFTP configuration ${configId} for tenant:`, tenantId);

    const query = `
      SELECT Id, TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName,
             RemotePath, ConfigurationJson, IsActive, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      FROM dbo.SftpConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configurations = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configId }
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
          error: 'SFTP configuration not found'
        }
      };
    }

    const row = configurations[0];
    const configuration: SftpConfiguration = {
      id: row.Id,
      tenantId: row.TenantId,
      name: row.Name,
      host: row.Host,
      port: row.Port,
      username: row.Username,
      authMethod: row.AuthMethod,
      keyVaultSecretName: row.KeyVaultSecretName,
      remotePath: row.RemotePath,
      configurationJson: row.ConfigurationJson,
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id'
      },
      jsonBody: {
        success: true,
        data: configuration
      }
    };
  } catch (error) {
    context.error('Error getting SFTP configuration:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to retrieve SFTP configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Create a new SFTP configuration
export async function createSftpConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configData: Partial<SftpConfiguration> = await request.json();

    // Validate required fields
    if (!configData.name || !configData.host || !configData.port || !configData.username || !configData.authMethod) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Missing required fields: name, host, port, username, authMethod'
        }
      };
    }

    // Validate credentials based on auth method
    if (configData.authMethod === 'password' && !configData.password) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Password is required for password authentication'
        }
      };
    }

    if (configData.authMethod === 'privateKey' && !configData.privateKey) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Private key is required for private key authentication'
        }
      };
    }

    context.log('Creating SFTP configuration for tenant:', tenantId);

    // Generate a unique config ID for Key Vault secret naming
    const configId = `${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate Key Vault secret name based on config ID
    const keyVaultSecretName = `sftp-${configId}-credentials`;

    // Store credentials in Key Vault based on auth method
    if (configData.authMethod === 'password' && configData.password) {
      await dbService.storeSftpPassword(tenantId, configId, configData.password);
    } else if (configData.authMethod === 'privateKey' && configData.privateKey) {
      await dbService.storeSftpPrivateKey(tenantId, configId, configData.privateKey);
    }

    const query = `
      INSERT INTO dbo.SftpConfigurations (
        TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName,
        RemotePath, ConfigurationJson, IsActive, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy
      )
      OUTPUT INSERTED.Id
      VALUES (
        @tenantId, @name, @host, @port, @username, @authMethod, @keyVaultSecretName,
        @remotePath, @configurationJson, 1, GETUTCDATE(), GETUTCDATE(), @createdBy, @updatedBy
      )
    `;

    const parameters = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'name', type: 'nvarchar', value: configData.name },
      { name: 'host', type: 'nvarchar', value: configData.host },
      { name: 'port', type: 'int', value: configData.port },
      { name: 'username', type: 'nvarchar', value: configData.username },
      { name: 'authMethod', type: 'nvarchar', value: configData.authMethod },
      { name: 'keyVaultSecretName', type: 'nvarchar', value: configData.keyVaultSecretName },
      { name: 'remotePath', type: 'nvarchar', value: configData.remotePath || null },
      { name: 'configurationJson', type: 'nvarchar', value: configData.configurationJson || null },
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
        message: 'SFTP configuration created successfully'
      }
    };
  } catch (error) {
    context.error('Error creating SFTP configuration:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to create SFTP configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Update an existing SFTP configuration
export async function updateSftpConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const configId = parseInt(request.params.id || '0');
    const configData: Partial<SftpConfiguration> = await request.json();

    if (isNaN(configId)) {
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

    context.log(`Updating SFTP configuration ${configId} for tenant:`, tenantId);

    // Check if configuration exists
    const checkQuery = `
      SELECT Id FROM dbo.SftpConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const checkResult = await dbService.executeQueryWithParams(checkQuery, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configId }
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
          error: 'SFTP configuration not found'
        }
      };
    }

    // Build dynamic update query
    const updateFields = [];
    const parameters: Array<{name: string, type: string, value: any}> = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configId },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ];

    if (configData.name !== undefined) {
      updateFields.push('Name = @name');
      parameters.push({ name: 'name', type: 'nvarchar', value: configData.name });
    }
    if (configData.host !== undefined) {
      updateFields.push('Host = @host');
      parameters.push({ name: 'host', type: 'nvarchar', value: configData.host });
    }
    if (configData.port !== undefined) {
      updateFields.push('Port = @port');
      parameters.push({ name: 'port', type: 'int', value: configData.port });
    }
    if (configData.username !== undefined) {
      updateFields.push('Username = @username');
      parameters.push({ name: 'username', type: 'nvarchar', value: configData.username });
    }
    if (configData.authMethod !== undefined) {
      updateFields.push('AuthMethod = @authMethod');
      parameters.push({ name: 'authMethod', type: 'nvarchar', value: configData.authMethod });
    }
    if (configData.keyVaultSecretName !== undefined) {
      updateFields.push('KeyVaultSecretName = @keyVaultSecretName');
      parameters.push({ name: 'keyVaultSecretName', type: 'nvarchar', value: configData.keyVaultSecretName });
    }
    if (configData.remotePath !== undefined) {
      updateFields.push('RemotePath = @remotePath');
      parameters.push({ name: 'remotePath', type: 'nvarchar', value: configData.remotePath });
    }
    if (configData.configurationJson !== undefined) {
      updateFields.push('ConfigurationJson = @configurationJson');
      parameters.push({ name: 'configurationJson', type: 'nvarchar', value: configData.configurationJson });
    }
    if (configData.isActive !== undefined) {
      updateFields.push('IsActive = @isActive');
      parameters.push({ name: 'isActive', type: 'bit', value: configData.isActive });
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
          error: 'No fields to update'
        }
      };
    }

    updateFields.push('UpdatedAt = GETUTCDATE()');
    updateFields.push('UpdatedBy = @updatedBy');

    const updateQuery = `
      UPDATE dbo.SftpConfigurations
      SET ${updateFields.join(', ')}
      WHERE Id = @configId AND TenantId = @tenantId
    `;

    await dbService.executeQueryWithParams(updateQuery, parameters);

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
        message: 'SFTP configuration updated successfully'
      }
    };
  } catch (error) {
    context.error('Error updating SFTP configuration:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to update SFTP configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Delete (soft delete) an SFTP configuration
export async function deleteSftpConfiguration(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    context.log(`Deleting SFTP configuration ${configId} for tenant:`, tenantId);

    const query = `
      UPDATE dbo.SftpConfigurations
      SET IsActive = 0, UpdatedAt = GETUTCDATE(), UpdatedBy = @updatedBy
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const parameters = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'configId', type: 'int', value: configId },
      { name: 'updatedBy', type: 'nvarchar', value: 'system' }
    ];

    const result = await dbService.executeQueryWithParams(query, parameters);

    if (result.length === 0 || result[0]?.rowsAffected === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'SFTP configuration not found'
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
        message: 'SFTP configuration deleted successfully'
      }
    };
  } catch (error) {
    context.error('Error deleting SFTP configuration:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to delete SFTP configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register the functions
app.http('getSftpConfigurations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/configurations/list',
  handler: getSftpConfigurations
});

app.http('getSftpConfiguration', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/configurations/{id}',
  handler: getSftpConfiguration
});

app.http('createSftpConfiguration', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/configurations',
  handler: createSftpConfiguration
});

app.http('updateSftpConfiguration', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/configurations/{id}',
  handler: updateSftpConfiguration
});

app.http('deleteSftpConfiguration', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/configurations/{id}',
  handler: deleteSftpConfiguration
});