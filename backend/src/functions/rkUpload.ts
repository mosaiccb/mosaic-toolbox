import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SftpService, SftpConfig } from '../services/SftpService';
import * as sql from 'mssql';

const sftpService = new SftpService();

/**
 * Upload file to Recordkeeper via SFTP
 * POST /api/rk/upload
 */
export async function rkUpload(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      };
    }

    const body = await request.json() as any;
    const { tenantId, recordkeeperName, fileName, fileContent } = body;

    if (!tenantId || !recordkeeperName || !fileName || !fileContent) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        jsonBody: { error: 'Missing required parameters' }
      };
    }

    // Get SFTP config from database
    const config = await getSftpConfig(tenantId, recordkeeperName);
    if (!config) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        jsonBody: { error: 'SFTP configuration not found' }
      };
    }

    // Connect to SFTP
    const conn = await sftpService.connect(config);

    // Upload file
    const remotePath = `${config.remotePath || '/'}${fileName}`;
    // For demo, assume fileContent is base64 or something
    // In real scenario, handle file upload properly
    await sftpService.uploadFile(conn, fileContent, remotePath);

    sftpService.disconnect(conn);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      jsonBody: { success: true, message: 'File uploaded successfully' }
    };

  } catch (error) {
    context.log('Error in rkUpload:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      jsonBody: { error: 'Internal server error' }
    };
  }
}

async function getSftpConfig(tenantId: string, name: string): Promise<SftpConfig | null> {
  // TODO: Implement database query
  // For now, return mock config
  return {
    id: 1,
    tenantId,
    name,
    host: 'sftp.example.com',
    port: 22,
    username: 'user',
    authMethod: 'password',
    keyVaultSecretName: 'sftp-password',
    isActive: true
  };
}

app.http('rkUpload', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: rkUpload
});