import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Client } from 'ssh2';

// SSH connectivity test from Azure Functions
export async function testSshConnection(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const body = await request.json() as any;
    const { host, port = 22, username = 'test', timeout = 15000 } = body;

    if (!host) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Host is required'
        }
      };
    }

    context.log(`Testing SSH connection from Azure Functions to ${host}:${port}`);

    const startTime = Date.now();
    let connectionLog: string[] = [];
    let handshakeDetails: any = {};

    const testResult = await new Promise<{success: boolean, message: string, details?: any}>((resolve) => {
      const conn = new Client();
      
      // Set timeout
      const timeoutHandle = setTimeout(() => {
        conn.end();
        resolve({
          success: false,
          message: `SSH connection timeout after ${timeout}ms`,
          details: {
            connectionTime: Date.now() - startTime,
            stage: 'connection_timeout',
            logs: connectionLog
          }
        });
      }, timeout);

      conn.on('ready', () => {
        clearTimeout(timeoutHandle);
        const connectionTime = Date.now() - startTime;
        connectionLog.push(`SSH connection established in ${connectionTime}ms`);
        
        // Close connection immediately since this is just a connectivity test
        conn.end();
        
        resolve({
          success: true,
          message: `🌟 SSH connection successful to ${host}:${port} - This is the GOLD STANDARD for SFTP connectivity!`,
          details: {
            connectionTime,
            stage: 'handshake_complete',
            logs: connectionLog,
            handshake: handshakeDetails
          }
        });
      });

      conn.on('error', (err: any) => {
        clearTimeout(timeoutHandle);
        const connectionTime = Date.now() - startTime;
        connectionLog.push(`SSH error: ${err.message}`);
        
        let errorType = 'unknown';
        let errorMessage = err.message;
        
        // Categorize SSH errors
        if (err.level === 'client-socket') {
          if (err.code === 'ECONNREFUSED') {
            errorType = 'connection_refused';
            errorMessage = 'Connection refused - port may be closed or service not running';
          } else if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
            errorType = 'network_error';
            errorMessage = `Network error: ${err.code}`;
          }
        } else if (err.level === 'client-timeout') {
          errorType = 'handshake_timeout';
          errorMessage = 'SSH handshake timeout - server may not support SSH or is blocking connections';
        } else if (err.level === 'client-authentication') {
          errorType = 'authentication_failed';
          errorMessage = 'Authentication failed (expected for test connection)';
        } else if (err.message.includes('handshake')) {
          errorType = 'handshake_error';
          errorMessage = 'SSH handshake failed - may be algorithm incompatibility';
        }
        
        resolve({
          success: false,
          message: errorMessage,
          details: {
            connectionTime,
            stage: 'error',
            errorType,
            originalError: err.message,
            errorLevel: err.level,
            errorCode: err.code,
            logs: connectionLog,
            handshake: handshakeDetails
          }
        });
      });

      conn.on('banner', (message: string) => {
        connectionLog.push(`Server banner: ${message}`);
      });

      conn.on('handshake', (negotiated: any) => {
        connectionLog.push('SSH handshake negotiated');
        handshakeDetails = {
          kex: negotiated.kex,
          srvHostKey: negotiated.srvHostKey,
          cs: negotiated.cs, // client to server
          sc: negotiated.sc  // server to client
        };
      });

      // Attempt connection
      connectionLog.push(`Connecting to ${host}:${port}...`);
      
      try {
        conn.connect({
          host: host,
          port: port,
          username: username,
          // Don't provide password/key - we just want to test connectivity
          // The connection will fail at auth, but that's after handshake succeeds
          tryKeyboard: false,
          // Connection settings
          readyTimeout: timeout,
          timeout: timeout,
          // Use optimized algorithms based on Maximus server capabilities
          algorithms: {
            kex: [
              'curve25519-sha256',
              'curve25519-sha256@libssh.org',
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384',
              'ecdh-sha2-nistp521'
            ],
            cipher: [
              'aes256-gcm@openssh.com',
              'aes256-gcm',
              'aes128-gcm@openssh.com',
              'aes128-gcm',
              'aes256-ctr',
              'aes128-ctr'
            ],
            hmac: [
              'hmac-sha2-256-etm@openssh.com',
              'hmac-sha2-256',
              'hmac-sha2-512-etm@openssh.com',
              'hmac-sha2-512'
            ],
            serverHostKey: [
              'rsa-sha2-512',
              'rsa-sha2-256',
              'ssh-rsa',
              'ssh-ed25519'
            ]
          }
        });
      } catch (connectError: any) {
        clearTimeout(timeoutHandle);
        connectionLog.push(`Connection attempt failed: ${connectError.message}`);
        resolve({
          success: false,
          message: `Connection setup failed: ${connectError.message}`,
          details: {
            connectionTime: Date.now() - startTime,
            stage: 'connection_setup_error',
            logs: connectionLog
          }
        });
      }
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: testResult.success,
        host,
        port,
        username,
        timeout,
        result: testResult,
        timestamp: new Date().toISOString(),
        sourceIP: 'Azure Functions outbound IP should be 52.154.139.3'
      }
    };

  } catch (error) {
    context.error('Error in SSH connectivity test:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Register HTTP route
app.http('testSshConnectivity', {
  methods: ['POST', 'OPTIONS'],
  route: 'network/ssh-test',
  handler: testSshConnection
});