import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from '../services/TenantDatabaseService';
import * as openpgp from 'openpgp';

// Initialize the database service
const dbService = new TenantDatabaseService();

export interface PgpKey {
  id?: number;
  tenantId: string;
  name: string;
  description?: string;
  keyVaultSecretName: string;
  keyType: 'public' | 'private';
  keyFingerprint?: string;
  isActive: boolean;
  createdAt?: Date;
  createdBy?: string;
}

export interface CreatePgpKeyRequest {
  name: string;
  description?: string;
  keyType: 'public' | 'private';
  keyData: string; // PGP key in ASCII armored format
}

export interface UpdatePgpKeyRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// Get all PGP keys for the authenticated tenant
export async function getPgpKeys(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    context.log(`Getting PGP keys for tenant: ${tenantId}`);

    const query = `
      SELECT Id, TenantId, Name, Description, KeyType, KeyFingerprint, IsActive, CreatedAt, CreatedBy
      FROM dbo.PgpKeys
      WHERE TenantId = @tenantId AND IsActive = 1
      ORDER BY Name
    `;

    const keys = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    // Map database field names to frontend interface
    const mappedKeys = keys.map((key: any) => ({
      id: key.Id,
      tenantId: key.TenantId,
      name: key.Name,
      description: key.Description,
      keyType: key.KeyType,
      fingerprint: key.KeyFingerprint,
      isActive: key.IsActive,
      createdAt: key.CreatedAt,
      createdBy: key.CreatedBy,
      usageCount: key.UsageCount || 0,
      lastUsedAt: key.LastUsedAt
    }));

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: {
        success: true,
        data: mappedKeys,
        count: keys.length
      }
    };
  } catch (error) {
    context.error('Error getting PGP keys:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to get PGP keys'
      }
    };
  }
}

// Get a specific PGP key by ID
export async function getPgpKey(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    // Get key ID from route parameter
    const keyId = parseInt(request.params.id || '0');

    if (!keyId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Valid key ID is required'
        }
      };
    }

    context.log(`Getting PGP key ${keyId} for tenant: ${tenantId}`);

    const query = `
      SELECT Id, TenantId, Name, Description, KeyType, KeyFingerprint, IsActive, CreatedAt, CreatedBy
      FROM dbo.PgpKeys
      WHERE Id = @keyId AND TenantId = @tenantId AND IsActive = 1
    `;

    const keys = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'keyId', type: 'int', value: keyId }
    ]);

    if (keys.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'PGP key not found'
        }
      };
    }

    // Map database field names to frontend interface
    const mappedKey = {
      id: keys[0].Id,
      tenantId: keys[0].TenantId,
      name: keys[0].Name,
      description: keys[0].Description,
      keyType: keys[0].KeyType,
      fingerprint: keys[0].KeyFingerprint,
      isActive: keys[0].IsActive,
      createdAt: keys[0].CreatedAt,
      createdBy: keys[0].CreatedBy,
      usageCount: keys[0].UsageCount || 0,
      lastUsedAt: keys[0].LastUsedAt
    };

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: {
        success: true,
        data: mappedKey
      }
    };
  } catch (error) {
    context.error('Error getting PGP key:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to get PGP key'
      }
    };
  }
}

// Create a new PGP key
export async function createPgpKey(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    const keyData = await request.json() as CreatePgpKeyRequest;

    // Validate required fields
    if (!keyData.name || !keyData.keyType || !keyData.keyData) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Name, key type, and key data are required'
        }
      };
    }

    // Validate key type
    if (!['public', 'private'].includes(keyData.keyType)) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Key type must be either "public" or "private"'
        }
      };
    }

    context.log(`Creating PGP key for tenant: ${tenantId}`);

    // Parse and validate the PGP key
    let fingerprint = '';
    try {
      const key = await openpgp.readKey({ armoredKey: keyData.keyData });
      fingerprint = key.getFingerprint();
      
      // Validate key type matches
      if (keyData.keyType === 'public' && key.isPrivate()) {
        throw new Error('Key data contains a private key but key type is set to public');
      }
      if (keyData.keyType === 'private' && !key.isPrivate()) {
        throw new Error('Key data contains a public key but key type is set to private');
      }
    } catch (error) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: `Invalid PGP key format: ${error instanceof Error ? error.message : error}`
        }
      };
    }

    // Generate a unique secret name for Key Vault
    const secretName = `pgp-${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${keyData.keyType}`;

    // Store the key in Key Vault
    await dbService.storeSecret(secretName, keyData.keyData);

    // Insert key metadata into database
    const query = `
      INSERT INTO dbo.PgpKeys (
        TenantId, Name, Description, KeyVaultSecretName, KeyType, KeyFingerprint, IsActive, CreatedAt, CreatedBy
      )
      OUTPUT INSERTED.Id, INSERTED.TenantId, INSERTED.Name, INSERTED.Description, 
             INSERTED.KeyType, INSERTED.KeyFingerprint, INSERTED.IsActive, INSERTED.CreatedAt, INSERTED.CreatedBy
      VALUES (
        @tenantId, @name, @description, @keyVaultSecretName, @keyType, @keyFingerprint, 1, GETUTCDATE(), 'system'
      )
    `;

    const result = await dbService.executeQueryWithParams(query, [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
      { name: 'name', type: 'nvarchar', value: keyData.name },
      { name: 'description', type: 'nvarchar', value: keyData.description || null },
      { name: 'keyVaultSecretName', type: 'nvarchar', value: secretName },
      { name: 'keyType', type: 'nvarchar', value: keyData.keyType },
      { name: 'keyFingerprint', type: 'nvarchar', value: fingerprint }
    ]);

    // Map database field names to frontend interface
    const mappedKey = {
      id: result[0].Id,
      tenantId: result[0].TenantId,
      name: result[0].Name,
      description: result[0].Description,
      keyType: result[0].KeyType,
      fingerprint: result[0].KeyFingerprint,
      isActive: result[0].IsActive,
      createdAt: result[0].CreatedAt,
      createdBy: result[0].CreatedBy,
      usageCount: 0,
      lastUsedAt: null
    };

    return {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: {
        success: true,
        data: mappedKey
      }
    };
  } catch (error) {
    context.error('Error creating PGP key:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to create PGP key'
      }
    };
  }
}

// Update a PGP key
export async function updatePgpKey(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    // Get key ID from route parameter
    const keyId = parseInt(request.params.id || '0');

    if (!keyId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Valid key ID is required'
        }
      };
    }

    const keyData = await request.json() as UpdatePgpKeyRequest;

    context.log(`Updating PGP key ${keyId} for tenant: ${tenantId}`);

    // Build dynamic update query
    const updateFields: string[] = [];
    const params: any[] = [
      { name: 'keyId', type: 'int', value: keyId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ];

    if (keyData.name !== undefined) {
      updateFields.push('Name = @name');
      params.push({ name: 'name', type: 'nvarchar', value: keyData.name });
    }

    if (keyData.description !== undefined) {
      updateFields.push('Description = @description');
      params.push({ name: 'description', type: 'nvarchar', value: keyData.description });
    }

    if (keyData.isActive !== undefined) {
      updateFields.push('IsActive = @isActive');
      params.push({ name: 'isActive', type: 'bit', value: keyData.isActive });
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
          error: 'No valid fields to update'
        }
      };
    }

    const query = `
      UPDATE dbo.PgpKeys
      SET ${updateFields.join(', ')}
      WHERE Id = @keyId AND TenantId = @tenantId
    `;

    await dbService.executeQueryWithParams(query, params);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: {
        success: true,
        message: 'PGP key updated successfully'
      }
    };
  } catch (error) {
    context.error('Error updating PGP key:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to update PGP key'
      }
    };
  }
}

// Delete a PGP key (soft delete)
export async function deletePgpKey(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    // Get key ID from route parameter
    const keyId = parseInt(request.params.id || '0');

    if (!keyId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Valid key ID is required'
        }
      };
    }

    context.log(`Deleting PGP key ${keyId} for tenant: ${tenantId}`);

    // Check if key is being used by any SFTP configurations
    const usageQuery = `
      SELECT COUNT(*) as UsageCount
      FROM dbo.SftpConfigurations
      WHERE PgpKeyName IS NOT NULL AND PgpKeyName = (
        SELECT KeyVaultSecretName FROM dbo.PgpKeys WHERE Id = @keyId AND TenantId = @tenantId
      ) AND IsActive = 1
    `;

    const usageResult = await dbService.executeQueryWithParams(usageQuery, [
      { name: 'keyId', type: 'int', value: keyId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (usageResult.length > 0 && usageResult[0].UsageCount > 0) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: `Cannot delete PGP key: it is being used by ${usageResult[0].UsageCount} SFTP configuration(s)`
        }
      };
    }

    // Soft delete the key
    const deleteQuery = `
      UPDATE dbo.PgpKeys
      SET IsActive = 0
      WHERE Id = @keyId AND TenantId = @tenantId
    `;

    await dbService.executeQueryWithParams(deleteQuery, [
      { name: 'keyId', type: 'int', value: keyId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: {
        success: true,
        message: 'PGP key deleted successfully'
      }
    };
  } catch (error) {
    context.error('Error deleting PGP key:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'Failed to delete PGP key'
      }
    };
  }
}

// Register the functions
app.http('getPgpKeys', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pgp/keys/list',
  handler: getPgpKeys
});

app.http('getPgpKey', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pgp/keys/get/{id}',
  handler: getPgpKey
});

app.http('createPgpKey', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pgp/keys',
  handler: createPgpKey
});

app.http('updatePgpKey', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pgp/keys/update/{id}',
  handler: updatePgpKey
});

app.http('deletePgpKey', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pgp/keys/delete/{id}',
  handler: deletePgpKey
});