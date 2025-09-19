import { Client } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import { TenantDatabaseService } from './TenantDatabaseService';

export interface SftpConfig {
  id: number;
  tenantId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: string; // 'password' or 'privateKey'
  keyVaultSecretName: string;
  remotePath?: string;
  configurationJson?: string; // Can include: { hostKeyFingerprints: string[], passphrase?: string }
  isActive: boolean;
}

// Configuration JSON structure for SFTP settings
export interface SftpConfigurationJson {
  hostKeyFingerprints?: string[];  // Array of expected host key fingerprints (SHA256)
  passphrase?: string;             // Passphrase for encrypted private keys
  timeout?: number;                // Connection timeout in milliseconds
  keepaliveInterval?: number;      // Keepalive interval in milliseconds
}

export class SftpService {
  private dbService: TenantDatabaseService;

  constructor() {
    this.dbService = new TenantDatabaseService();
  }

  private async getSecretFromKeyVault(secretName: string): Promise<string> {
    try {
      const secret = await this.dbService.getSecretByName(secretName);
      if (!secret) {
        throw new Error(`Secret not found in Key Vault: ${secretName}`);
      }
      return secret;
    } catch (error) {
      console.error('Error retrieving secret from Key Vault:', error);
      throw error;
    }
  }

  async connect(config: SftpConfig): Promise<Client> {
    try {
      // Get credentials from Key Vault using the exact secret name
      const credential = await this.getSecretFromKeyVault(config.keyVaultSecretName);

      return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
          resolve(conn);
        });

        conn.on('error', (err) => {
          reject(err);
        });

        const connectConfig: any = {
          host: config.host,
          port: config.port,
          username: config.username,
          // Increase timeout and add additional options for better compatibility
          readyTimeout: 30000, // 30 seconds instead of default 20
          timeout: 30000, // Connection timeout
          keepaliveInterval: 15000, // Keep connection alive
          // Add algorithm preferences optimized for Maximus server (based on FilezZilla logs)
          algorithms: {
            kex: [
              'curve25519-sha256',           // Maximus uses ECDH with Curve25519 - prioritize this
              'curve25519-sha256@libssh.org',
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384', 
              'ecdh-sha2-nistp521',
              'diffie-hellman-group14-sha256',
              'diffie-hellman-group16-sha512'
            ],
            cipher: [
              'aes256-gcm@openssh.com',      // Maximus uses AES-256 GCM - prioritize this
              'aes256-gcm',
              'aes128-gcm@openssh.com',
              'aes128-gcm',
              'aes256-ctr',
              'aes192-ctr',
              'aes128-ctr'
            ],
            hmac: [
              'hmac-sha2-256-etm@openssh.com', // Match ETM mode that Maximus uses
              'hmac-sha2-256',               // Maximus uses SHA-256
              'hmac-sha2-512-etm@openssh.com',
              'hmac-sha2-512',
              'hmac-sha1'
            ],
            serverHostKey: [
              'ssh-rsa',                     // Maximus uses ssh-rsa 2048
              'rsa-sha2-512',
              'rsa-sha2-256',
              'ssh-ed25519'
            ]
          },
          // Host key verification - can be configured per server
          hostVerifier: (keyHash: string, callback: (verified: boolean) => void) => {
            // Parse configuration JSON for expected fingerprints
            if (config.configurationJson) {
              try {
                const configJson = JSON.parse(config.configurationJson);
                if (configJson.hostKeyFingerprints && Array.isArray(configJson.hostKeyFingerprints)) {
                  const expectedFingerprints = configJson.hostKeyFingerprints;
                  const verified = expectedFingerprints.some((fp: string) => 
                    fp === keyHash || fp === keyHash.replace(/^SHA256:/, '')
                  );
                  console.log(`Host key verification for ${config.host}: ${verified ? 'PASSED' : 'FAILED'}`);
                  console.log(`Received: ${keyHash}`);
                  console.log(`Expected: ${expectedFingerprints.join(', ')}`);
                  return callback(verified);
                }
              } catch (e) {
                console.warn('Failed to parse configuration JSON for host key verification:', e);
              }
            }
            
            // If no fingerprints configured, accept any key (for backward compatibility)
            // In production, you might want to make this more strict
            console.log(`No host key fingerprints configured for ${config.host}, accepting connection`);
            return callback(true);
          }
        };

        if (config.authMethod === 'password') {
          connectConfig.password = credential;
        } else if (config.authMethod === 'privateKey') {
          connectConfig.privateKey = credential;
          // Add passphrase support if needed
          if (config.configurationJson) {
            try {
              const configJson = JSON.parse(config.configurationJson);
              if (configJson.passphrase) {
                connectConfig.passphrase = configJson.passphrase;
              }
            } catch (e) {
              // Ignore JSON parsing errors
            }
          }
        }

        conn.connect(connectConfig);
      });
    } catch (error) {
      throw new Error(`Failed to connect to SFTP: ${error instanceof Error ? error.message : error}`);
    }
  }

  async uploadFile(conn: Client, localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if local file exists before attempting upload
      if (!fs.existsSync(localPath)) {
        return reject(new Error(`Local file does not exist: ${localPath}`));
      }

      const stats = fs.statSync(localPath);
      if (!stats.isFile()) {
        return reject(new Error(`Path is not a file: ${localPath}`));
      }

      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        const readStream = fs.createReadStream(localPath);
        const writeStream = sftp.createWriteStream(remotePath);

        readStream.on('error', (err) => {
          reject(new Error(`Failed to read local file: ${err.message}`));
        });

        writeStream.on('close', () => {
          resolve();
        });

        writeStream.on('error', (err) => {
          reject(new Error(`Failed to write to remote path: ${err.message}`));
        });

        readStream.pipe(writeStream);
      });
    });
  }

  async downloadFile(conn: Client, remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        const readStream = sftp.createReadStream(remotePath);
        const writeStream = fs.createWriteStream(localPath);

        writeStream.on('close', () => {
          resolve();
        });

        writeStream.on('error', (err) => {
          reject(err);
        });

        readStream.pipe(writeStream);
      });
    });
  }

  async listFiles(conn: Client, remotePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        sftp.readdir(remotePath, (err, list) => {
          if (err) return reject(err);
          resolve(list);
        });
      });
    });
  }

  disconnect(conn: Client): void {
    conn.end();
  }

  /**
   * Test SFTP connection and return connection status
   */
  async testConnection(config: SftpConfig): Promise<{
    success: boolean;
    message: string;
    details?: {
      host: string;
      port: number;
      username: string;
      authMethod: string;
      connectionTime?: number;
      sshConnectivity?: string;
      directoryListing?: string;
      directoryTestDetails?: string;
      capabilities?: {
        canUpload: boolean;
        canDownload: boolean;
        canBrowse: boolean;
      };
    };
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      console.log(`Testing SFTP connection to ${config.host}:${config.port} with user ${config.username}`);
      
      // Add a timeout wrapper around the entire connection process
      const conn = await Promise.race([
        this.connect(config),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 45 seconds')), 45000)
        )
      ]);
      const connectionTime = Date.now() - startTime;
      
      // Test SFTP capabilities
      await new Promise<void>((resolve, reject) => {
        conn.sftp((err, sftp) => {
          if (err) {
            reject(new Error(`SFTP initialization failed: ${err.message}`));
          } else {
            resolve();
          }
        });
      });
      
      // Clean disconnect
      this.disconnect(conn);
      
      // Try to test directory listing capability (optional)
      let directoryListingSupported = false;
      let directoryTestMessage = '';
      
      try {
        const testConn = await this.connect(config);
        await new Promise<void>((resolve, reject) => {
          testConn.sftp((err, sftp) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Try to list root directory with a short timeout
            const timeoutHandle = setTimeout(() => {
              directoryListingSupported = false;
              directoryTestMessage = 'Directory listing timeout (server may restrict browsing)';
              resolve();
            }, 5000); // 5 second timeout for directory test
            
            sftp.readdir('/', (listErr, files) => {
              clearTimeout(timeoutHandle);
              if (listErr) {
                directoryListingSupported = false;
                directoryTestMessage = `Directory listing not supported (${listErr.message})`;
              } else {
                directoryListingSupported = true;
                directoryTestMessage = `Directory listing supported (${files?.length || 0} items found)`;
              }
              resolve();
            });
          });
        });
        this.disconnect(testConn);
      } catch (dirError) {
        directoryListingSupported = false;
        directoryTestMessage = 'Directory listing test failed (server may restrict browsing)';
      }
      
      return {
        success: true,
        message: `🌟 GOLD STAR: SSH/SFTP Connection Successful! Server is reachable and credentials are valid.`,
        details: {
          host: config.host,
          port: config.port,
          username: config.username,
          authMethod: config.authMethod,
          connectionTime,
          sshConnectivity: '✅ GOLD STAR - Full SSH/SFTP access confirmed',
          directoryListing: directoryListingSupported ? '✅ Supported - Can browse and download files' : '⚠️ Restricted - Upload-only (typical for secure third-party servers)',
          directoryTestDetails: directoryTestMessage,
          capabilities: {
            canUpload: true, // Always true if SSH/SFTP works
            canDownload: directoryListingSupported,
            canBrowse: directoryListingSupported
          }
        }
      };
      
    } catch (error: any) {
      const connectionTime = Date.now() - startTime;
      
      let errorMessage = 'Unknown error';
      let detailedError = error?.message || error;
      
      // Categorize common SFTP errors
      if (error?.level === 'client-authentication') {
        errorMessage = 'Authentication failed - please check username and credentials';
      } else if (error?.level === 'client-timeout' || error?.message?.includes('handshake')) {
        errorMessage = 'Handshake timeout - server may not support SSH/SFTP or firewall blocking connection';
      } else if (error?.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - please check host and port';
      } else if (error?.code === 'ENOTFOUND') {
        errorMessage = 'Host not found - please check the hostname';
      } else if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
        errorMessage = 'Connection timeout - please check network connectivity and firewall settings';
      } else if (error?.message?.includes('Key Vault')) {
        errorMessage = 'Credential retrieval failed - please check Key Vault configuration';
      } else if (error?.message?.includes('key exchange') || error?.message?.includes('algorithm')) {
        errorMessage = 'Key exchange failed - server may require specific SSH algorithms';
      } else {
        errorMessage = `Connection failed: ${detailedError}`;
      }
      
      console.error(`SFTP connection test failed for ${config.host}:${config.port}:`, error);
      
      return {
        success: false,
        message: errorMessage,
        details: {
          host: config.host,
          port: config.port,
          username: config.username,
          authMethod: config.authMethod,
          connectionTime
        },
        error: detailedError
      };
    }
  }
}