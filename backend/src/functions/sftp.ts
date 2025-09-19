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
    context.error('Error details:', error instanceof Error ? error.message : String(error));
    context.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: { 
        error: 'Failed to list SFTP files',
        details: error instanceof Error ? error.message : String(error)
      },
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
    const remoteDir = formData.get('remotePath') as string;
    const configId = formData.get('configId') as string;

    if (!file || !remoteDir || !configId) {
      return {
        status: 400,
        jsonBody: { error: 'File, remote directory, and configuration ID are required' },
      };
    }

    const fileName = (file as any).name || `upload_${Date.now()}`;
    // Construct full remote file path - make it mutable for PGP encryption
    let remotePath = remoteDir.endsWith('/') 
      ? `${remoteDir}${fileName}` 
      : `${remoteDir}/${fileName}`;

    context.log(`Remote directory: ${remoteDir}`);
    context.log(`File name: ${fileName}`);
    context.log(`Full remote path: ${remotePath}`);

    // Get configuration from database including PGP settings
    const configQuery = `
      SELECT s.Id, s.TenantId, s.Name, s.Host, s.Port, s.Username, s.AuthMethod, s.KeyVaultSecretName, 
             s.RemotePath, s.ConfigurationJson, s.IsActive, s.PgpKeyId, s.EnablePgpEncryption
      FROM dbo.SftpConfigurations s
      WHERE s.Id = @configId AND s.TenantId = @tenantId AND s.IsActive = 1
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
      pgpKeyId: config.PgpKeyId,
      enablePgpEncryption: config.EnablePgpEncryption,
    };

    // Get file buffer for processing
    const buffer = Buffer.from(await (file as any).arrayBuffer());
    context.log(`Original file size: ${buffer.length} bytes`);

    let finalBuffer = buffer;
    let finalFileName = fileName;

    // Handle PGP encryption if enabled
    if (sftpConfig.enablePgpEncryption && sftpConfig.pgpKeyId) {
      try {
        const { PgpService } = await import('../services/PgpService');
        const pgpService = new PgpService();

        const encryptionResult = await pgpService.encryptData({
          data: new Uint8Array(buffer),
          keyId: sftpConfig.pgpKeyId,
          tenantId: sftpConfig.tenantId,
          filename: fileName
        });

        finalBuffer = Buffer.from(encryptionResult.encryptedData);
        finalFileName = fileName.endsWith('.pgp') ? fileName : `${fileName}.pgp`;
        
        context.log(`File encrypted successfully. Original size: ${encryptionResult.originalSize}, Encrypted size: ${encryptionResult.encryptedSize}`);
        context.log(`PGP key fingerprint: ${encryptionResult.keyFingerprint}`);
        
        // Update remote path with encrypted filename
        const updatedRemotePath = remoteDir.endsWith('/') 
          ? `${remoteDir}${finalFileName}` 
          : `${remoteDir}/${finalFileName}`;
        remotePath = updatedRemotePath;
        
      } catch (pgpError) {
        context.error('PGP encryption failed:', pgpError);
        return {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          jsonBody: { 
            error: 'PGP encryption failed', 
            details: pgpError instanceof Error ? pgpError.message : 'Unknown encryption error'
          }
        };
      }
    }

    // Save file temporarily - use proper temp directory for Azure Functions
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, fileName);
    
    context.log(`Saving temp file to: ${tempPath}`);
    context.log(`Temp directory: ${tempDir}`);
    
    // Use the final buffer (either original or encrypted)
    context.log(`Final buffer size: ${finalBuffer.length} bytes`);
    
    fs.writeFileSync(tempPath, finalBuffer);
    
    // Verify file was created
    if (!fs.existsSync(tempPath)) {
      throw new Error(`Failed to create temporary file at ${tempPath}`);
    }
    
    const stats = fs.statSync(tempPath);
    context.log(`Temp file created successfully. Size: ${stats.size} bytes`);

    // Connect to SFTP and upload
    const conn = await sftpService.connect(sftpConfig);

    try {
      await sftpService.uploadFile(conn, tempPath, remotePath);

      // Clean up temp file
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        context.warn('Failed to clean up temp file:', cleanupError);
      }

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

    // Create temp file path - use proper temp directory for Azure Functions
    const os = require('os');
    const path = require('path');
    const tempDir = os.tmpdir();
    const fileName = path.basename(remotePath);
    const tempPath = path.join(tempDir, fileName);

    // Connect to SFTP and download
    const conn = await sftpService.connect(sftpConfig);

    try {
      await sftpService.downloadFile(conn, remotePath, tempPath);

      // Read file and return as response
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(tempPath);

      // Clean up temp file
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        context.warn('Failed to clean up temp file:', cleanupError);
      }

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

// Test SFTP connection
export async function testSftpConnection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const { configId } = body;

    if (!configId) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
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

    context.log(`Testing SFTP connection for config ${configId}: ${sftpConfig.host}:${sftpConfig.port}`);

    // Test the connection
    const testResult = await sftpService.testConnection(sftpConfig);

    return {
      status: testResult.success ? 200 : 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
      jsonBody: testResult,
    };
  } catch (error) {
    context.error('Error testing SFTP connection:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      jsonBody: { 
        success: false,
        error: 'Failed to test SFTP connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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

app.http('sftp-test', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'sftp/test',
  handler: testSftpConnection,
});