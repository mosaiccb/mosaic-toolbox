import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SftpService } from '../services/SftpService';
import { TenantDatabaseService } from '../services/TenantDatabaseService';

export interface SftpFile {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
  path: string;
}

const sftpService = new SftpService();
const dbService = new TenantDatabaseService();

// List files in SFTP directory
export async function listSftpFiles(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';

    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '/';
    const configId = url.searchParams.get('configId');

    if (!configId) {
      return {
        status: 400,
        jsonBody: { error: 'Configuration ID is required' },
      };
    }

    // Get configuration from database
    const configQuery = `
      SELECT Id, TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName, RemotePath, ConfigurationJson, IsActive
      FROM dbo.SftpConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configResult = await dbService.executeQueryWithParams(configQuery, [
      { name: 'configId', type: 'int', value: parseInt(configId) },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (configResult.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'SFTP configuration not found' },
      };
    }

    const config = configResult[0];
    const sftpConfig = {
      id: config.Id,
      tenantId: config.TenantId,
      name: config.Name,
      host: config.Host,
      port: config.Port,
      username: config.Username,
      authMethod: config.AuthMethod,
      keyVaultSecretName: config.KeyVaultSecretName,
      remotePath: config.RemotePath,
      configurationJson: config.ConfigurationJson,
      isActive: config.IsActive,
    };

    // Connect to SFTP
    const conn = await sftpService.connect(sftpConfig);

    try {
      // List files
      const fileList = await sftpService.listFiles(conn, path);

      // Transform to our format
      const files: SftpFile[] = fileList.map((file: any) => ({
        name: file.filename,
        type: file.longname.startsWith('d') ? 'directory' : 'file',
        size: file.attrs.size,
        modified: file.attrs.mtime ? new Date(file.attrs.mtime * 1000).toISOString() : undefined,
        permissions: file.longname.substring(1, 10),
        path: path === '/' ? `/${file.filename}` : `${path}/${file.filename}`,
      }));

      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
        },
        jsonBody: { files },
      };
    } finally {
      sftpService.disconnect(conn);
    }
  } catch (error) {
    context.error('Error listing SFTP files:', error);
    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: { error: 'Failed to list SFTP files' },
    };
  }
}

// Upload file to SFTP
export async function uploadSftpFile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';

    const formData = await request.formData();
    const file = formData.get('file') as any; // FormDataEntryValue
    const remotePath = formData.get('remotePath') as string;
    const configId = formData.get('configId') as string;

    if (!file || !remotePath || !configId) {
      return {
        status: 400,
        jsonBody: { error: 'File, remote path, and configuration ID are required' },
      };
    }

    // Get configuration from database
    const configQuery = `
      SELECT Id, TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName, RemotePath, ConfigurationJson, IsActive
      FROM dbo.SftpConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configResult = await dbService.executeQueryWithParams(configQuery, [
      { name: 'configId', type: 'int', value: parseInt(configId) },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (configResult.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'SFTP configuration not found' },
      };
    }

    const config = configResult[0];
    const sftpConfig = {
      id: config.Id,
      tenantId: config.TenantId,
      name: config.Name,
      host: config.Host,
      port: config.Port,
      username: config.Username,
      authMethod: config.AuthMethod,
      keyVaultSecretName: config.KeyVaultSecretName,
      remotePath: config.RemotePath,
      configurationJson: config.ConfigurationJson,
      isActive: config.IsActive,
    };

    // Save file temporarily
    const tempPath = `/tmp/${(file as any).name || 'upload'}`;
    const buffer = Buffer.from(await (file as any).arrayBuffer());
    require('fs').writeFileSync(tempPath, buffer);

    // Connect to SFTP and upload
    const conn = await sftpService.connect(sftpConfig);

    try {
      await sftpService.uploadFile(conn, tempPath, remotePath);

      // Clean up temp file
      require('fs').unlinkSync(tempPath);

      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
        },
        jsonBody: { message: 'File uploaded successfully' },
      };
    } finally {
      sftpService.disconnect(conn);
    }
  } catch (error) {
    context.error('Error uploading SFTP file:', error);
    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: { error: 'Failed to upload file' },
    };
  }
}

// Download file from SFTP
export async function downloadSftpFile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';

    const url = new URL(request.url);
    const remotePath = url.searchParams.get('path');
    const configId = url.searchParams.get('configId');

    if (!remotePath || !configId) {
      return {
        status: 400,
        jsonBody: { error: 'Remote path and configuration ID are required' },
      };
    }

    // Get configuration from database
    const configQuery = `
      SELECT Id, TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName, RemotePath, ConfigurationJson, IsActive
      FROM dbo.SftpConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configResult = await dbService.executeQueryWithParams(configQuery, [
      { name: 'configId', type: 'int', value: parseInt(configId) },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (configResult.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'SFTP configuration not found' },
      };
    }

    const config = configResult[0];
    const sftpConfig = {
      id: config.Id,
      tenantId: config.TenantId,
      name: config.Name,
      host: config.Host,
      port: config.Port,
      username: config.Username,
      authMethod: config.AuthMethod,
      keyVaultSecretName: config.KeyVaultSecretName,
      remotePath: config.RemotePath,
      configurationJson: config.ConfigurationJson,
      isActive: config.IsActive,
    };

    // Create temp file path
    const tempPath = `/tmp/${require('path').basename(remotePath)}`;

    // Connect to SFTP and download
    const conn = await sftpService.connect(sftpConfig);

    try {
      await sftpService.downloadFile(conn, remotePath, tempPath);

      // Read file and return as response
      const fileBuffer = require('fs').readFileSync(tempPath);

      // Clean up temp file
      require('fs').unlinkSync(tempPath);

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${require('path').basename(remotePath)}"`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
        },
        body: fileBuffer,
      };
    } finally {
      sftpService.disconnect(conn);
    }
  } catch (error) {
    context.error('Error downloading SFTP file:', error);
    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: { error: 'Failed to download file' },
    };
  }
}

// Delete file from SFTP
export async function deleteSftpFile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';

    const body = await request.json() as any;
    const { path: remotePath, configId } = body;

    if (!remotePath || !configId) {
      return {
        status: 400,
        jsonBody: { error: 'Remote path and configuration ID are required' },
      };
    }

    // Get configuration from database
    const configQuery = `
      SELECT Id, TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName, RemotePath, ConfigurationJson, IsActive
      FROM dbo.SftpConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configResult = await dbService.executeQueryWithParams(configQuery, [
      { name: 'configId', type: 'int', value: parseInt(configId) },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (configResult.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'SFTP configuration not found' },
      };
    }

    const config = configResult[0];
    const sftpConfig = {
      id: config.Id,
      tenantId: config.TenantId,
      name: config.Name,
      host: config.Host,
      port: config.Port,
      username: config.Username,
      authMethod: config.AuthMethod,
      keyVaultSecretName: config.KeyVaultSecretName,
      remotePath: config.RemotePath,
      configurationJson: config.ConfigurationJson,
      isActive: config.IsActive,
    };

    // Connect to SFTP
    const conn = await sftpService.connect(sftpConfig);

    try {
      // Use SFTP to delete file
      conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.unlink(remotePath, (err) => {
          if (err) throw err;
        });
      });

      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
        },
        jsonBody: { message: 'File deleted successfully' },
      };
    } finally {
      sftpService.disconnect(conn);
    }
  } catch (error) {
    context.error('Error deleting SFTP file:', error);
    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: { error: 'Failed to delete file' },
    };
  }
}

// Create directory on SFTP
export async function createSftpDirectory(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';

    const body = await request.json() as any;
    const { path: remotePath, configId } = body;

    if (!remotePath || !configId) {
      return {
        status: 400,
        jsonBody: { error: 'Remote path and configuration ID are required' },
      };
    }

    // Get configuration from database
    const configQuery = `
      SELECT Id, TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName, RemotePath, ConfigurationJson, IsActive
      FROM dbo.SftpConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configResult = await dbService.executeQueryWithParams(configQuery, [
      { name: 'configId', type: 'int', value: parseInt(configId) },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (configResult.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'SFTP configuration not found' },
      };
    }

    const config = configResult[0];
    const sftpConfig = {
      id: config.Id,
      tenantId: config.TenantId,
      name: config.Name,
      host: config.Host,
      port: config.Port,
      username: config.Username,
      authMethod: config.AuthMethod,
      keyVaultSecretName: config.KeyVaultSecretName,
      remotePath: config.RemotePath,
      configurationJson: config.ConfigurationJson,
      isActive: config.IsActive,
    };

    // Connect to SFTP
    const conn = await sftpService.connect(sftpConfig);

    try {
      // Use SFTP to create directory
      conn.sftp((err, sftp) => {
        if (err) throw err;
        sftp.mkdir(remotePath, (err) => {
          if (err) throw err;
        });
      });

      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
        },
        jsonBody: { message: 'Directory created successfully' },
      };
    } finally {
      sftpService.disconnect(conn);
    }
  } catch (error) {
    context.error('Error creating SFTP directory:', error);
    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: { error: 'Failed to create directory' },
    };
  }
}

// Get file info from SFTP
export async function getSftpFileInfo(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    // Get tenant ID from headers
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';

    const url = new URL(request.url);
    const remotePath = url.searchParams.get('path');
    const configId = url.searchParams.get('configId');

    if (!remotePath || !configId) {
      return {
        status: 400,
        jsonBody: { error: 'Remote path and configuration ID are required' },
      };
    }

    // Get configuration from database
    const configQuery = `
      SELECT Id, TenantId, Name, Host, Port, Username, AuthMethod, KeyVaultSecretName, RemotePath, ConfigurationJson, IsActive
      FROM dbo.SftpConfigurations
      WHERE Id = @configId AND TenantId = @tenantId AND IsActive = 1
    `;

    const configResult = await dbService.executeQueryWithParams(configQuery, [
      { name: 'configId', type: 'int', value: parseInt(configId) },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (configResult.length === 0) {
      return {
        status: 404,
        jsonBody: { error: 'SFTP configuration not found' },
      };
    }

    const config = configResult[0];
    const sftpConfig = {
      id: config.Id,
      tenantId: config.TenantId,
      name: config.Name,
      host: config.Host,
      port: config.Port,
      username: config.Username,
      authMethod: config.AuthMethod,
      keyVaultSecretName: config.KeyVaultSecretName,
      remotePath: config.RemotePath,
      configurationJson: config.ConfigurationJson,
      isActive: config.IsActive,
    };

    // Connect to SFTP
    const conn = await sftpService.connect(sftpConfig);

    try {
      // Use SFTP to get file stats
      const stats = await new Promise<any>((resolve, reject) => {
        conn.sftp((err, sftp) => {
          if (err) return reject(err);
          sftp.stat(remotePath, (err, stats) => {
            if (err) return reject(err);
            resolve(stats);
          });
        });
      });

      const fileInfo: SftpFile = {
        name: require('path').basename(remotePath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime ? new Date(stats.mtime).toISOString() : undefined,
        permissions: stats.mode ? (stats.mode & 0o777).toString(8) : undefined,
        path: remotePath,
      };

      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
        },
        jsonBody: fileInfo,
      };
    } finally {
      sftpService.disconnect(conn);
    }
  } catch (error) {
    context.error('Error getting SFTP file info:', error);
    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: { error: 'Failed to get file info' },
    };
  }
}

app.http('sftp-list', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/list',
  handler: listSftpFiles,
});

app.http('sftp-upload', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/upload',
  handler: uploadSftpFile,
});

app.http('sftp-download', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/download',
  handler: downloadSftpFile,
});

app.http('sftp-delete', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/delete',
  handler: deleteSftpFile,
});

app.http('sftp-mkdir', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/mkdir',
  handler: createSftpDirectory,
});

app.http('sftp-info', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/info',
  handler: getSftpFileInfo,
});