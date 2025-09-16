import { Client } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';

export interface SftpConfig {
  id: number;
  tenantId: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: string; // 'password' or 'key'
  keyVaultSecretName: string;
  remotePath?: string;
  configurationJson?: string;
  isActive: boolean;
}

export class SftpService {
  private async getSecretFromKeyVault(secretName: string): Promise<string> {
    // TODO: Implement Key Vault access
    // For now, return placeholder
    return process.env[secretName] || 'placeholder';
  }

  async connect(config: SftpConfig): Promise<Client> {
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
      };

      if (config.authMethod === 'password') {
        connectConfig.password = this.getSecretFromKeyVault(config.keyVaultSecretName);
      } else {
        // Key-based auth
        connectConfig.privateKey = this.getSecretFromKeyVault(config.keyVaultSecretName);
      }

      conn.connect(connectConfig);
    });
  }

  async uploadFile(conn: Client, localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);

        const readStream = fs.createReadStream(localPath);
        const writeStream = sftp.createWriteStream(remotePath);

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
}