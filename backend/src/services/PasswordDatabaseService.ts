// Database service for password management
// Uses SQL Server for password metadata and Azure Key Vault for encrypted password storage

import * as sql from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

export interface PasswordEntry {
  id: string;
  title: string;
  username?: string;
  website?: string;
  notes?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
  favorite: boolean;
  createdBy?: string;
  updatedBy?: string;
}

export interface CreatePasswordRequest {
  title: string;
  username?: string;
  password: string;
  website?: string;
  notes?: string;
  category?: string;
  favorite?: boolean;
  createdBy?: string;
}

export interface UpdatePasswordRequest {
  title?: string;
  username?: string;
  password?: string;
  website?: string;
  notes?: string;
  category?: string;
  favorite?: boolean;
  updatedBy?: string;
}

export class PasswordDatabaseService {
  private keyVaultClient: SecretClient;
  private credential: DefaultAzureCredential;
  private pool: sql.ConnectionPool | null = null;

  constructor() {
    // Initialize Azure credentials for Key Vault access (same pattern as TenantDatabaseService)
    const clientId = process.env.AZURE_CLIENT_ID || '4663051e-32cf-49ed-9759-2ef91bbe9d73';
    this.credential = new DefaultAzureCredential({
      managedIdentityClientId: clientId
    });
    
    // Initialize Key Vault client for secrets
    const keyVaultName = process.env.KEY_VAULT_NAME || 'mosaic-toolbox-kv';
    const keyVaultUrl = process.env.AZURE_KEY_VAULT_ENDPOINT || `https://${keyVaultName}.vault.azure.net/`;
    this.keyVaultClient = new SecretClient(keyVaultUrl, this.credential);
  }

  /**
   * Parse SQL connection string to mssql config
   * @param connectionString Connection string to parse
   * @returns Parsed connection configuration for mssql
   */
  private parseConnectionStringToConfig(connectionString: string): sql.config {
    const config: any = {
      options: {
        encrypt: true,
        trustServerCertificate: false,
        requestTimeout: 30000,
        connectTimeout: 30000,
        enableArithAbort: true
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };
    
    const parts = connectionString.split(';');
    
    parts.forEach(part => {
      const [key, value] = part.split('=', 2);
      if (key && value) {
        const cleanKey = key.trim().toLowerCase();
        const cleanValue = value.trim();
        
        switch (cleanKey) {
          case 'server':
            config.server = cleanValue;
            break;
          case 'database':
            config.database = cleanValue;
            break;
          case 'user id':
          case 'uid':
            config.user = cleanValue;
            break;
          case 'password':
          case 'pwd':
            config.password = cleanValue;
            break;
          case 'encrypt':
            config.options.encrypt = cleanValue.toLowerCase() === 'true';
            break;
        }
      }
    });
    
    return config;
  }

  /**
   * Get database connection pool using SQL authentication
   * @returns Promise<sql.ConnectionPool>
   */
  private async getConnectionPool(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }

    // Use SQL authentication only (same pattern as TenantDatabaseService)
    this.pool = await this.createConnectionWithFallback();
    return this.pool;
  }

  /**
   * Create connection using SQL authentication only
   * @returns Promise<sql.ConnectionPool>
   */
  private async createConnectionWithFallback(): Promise<sql.ConnectionPool> {
    const connectionString = process.env.SQL_CONNECTION_STRING;
    if (connectionString) {
      try {
        console.log('Attempting SQL authentication for password service...');
        const sqlConfig = this.parseConnectionStringToConfig(connectionString);
        const sqlPool = new sql.ConnectionPool(sqlConfig);
        await sqlPool.connect();
        console.log('✅ Password service connected using SQL authentication');
        return sqlPool;
      } catch (sqlError: any) {
        console.error('❌ Password service SQL authentication failed:', sqlError?.message || sqlError);
        throw new Error(`Password service SQL authentication failed: ${sqlError?.message || sqlError}`);
      }
    } else {
      throw new Error('SQL_CONNECTION_STRING is required for SQL authentication');
    }
  }

  /**
   * Execute a SQL query using mssql
   * @param query SQL query string
   * @param parameters Query parameters
   * @returns Promise<any[]>
   */
  private async executeQuery(query: string, parameters: { [key: string]: any } = {}): Promise<any[]> {
    const pool = await this.getConnectionPool();
    const request = pool.request();
    
    // Add parameters to request
    Object.keys(parameters).forEach(key => {
      request.input(key, parameters[key]);
    });

    const result = await request.query(query);
    return result.recordset || [];
  }

  /**
   * Generate a new GUID
   * @returns string
   */
  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Store password in Key Vault
   * @param passwordId Password entry ID
   * @param password Password value
   * @returns Promise<void>
   */
  private async storePasswordInKeyVault(passwordId: string, password: string): Promise<void> {
    try {
      const secretName = `password-${passwordId}`;
      await this.keyVaultClient.setSecret(secretName, password);
      console.log(`✅ Password stored in Key Vault: ${secretName}`);
    } catch (error) {
      console.error(`❌ Error storing password in Key Vault for ${passwordId}:`, error);
      throw error;
    }
  }

  /**
   * Get password from Key Vault
   * @param passwordId Password entry ID
   * @returns Promise<string | null>
   */
  private async getPasswordFromKeyVault(passwordId: string): Promise<string | null> {
    try {
      const secretName = `password-${passwordId}`;
      const secret = await this.keyVaultClient.getSecret(secretName);
      return secret.value || null;
    } catch (error) {
      console.error(`❌ Error retrieving password from Key Vault for ${passwordId}:`, error);
      return null;
    }
  }

  /**
   * Delete password from Key Vault
   * @param passwordId Password entry ID
   * @returns Promise<void>
   */
  private async deletePasswordFromKeyVault(passwordId: string): Promise<void> {
    try {
      const secretName = `password-${passwordId}`;
      await this.keyVaultClient.beginDeleteSecret(secretName);
      console.log(`✅ Password deleted from Key Vault: ${secretName}`);
    } catch (error) {
      console.error(`❌ Error deleting password from Key Vault for ${passwordId}:`, error);
      // Don't throw here - we still want to delete the metadata even if Key Vault cleanup fails
    }
  }

  /**
   * Initialize the password database table if it doesn't exist
   * @returns Promise<void>
   */
  async initializeDatabase(): Promise<void> {
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PasswordEntries' AND xtype='U')
      BEGIN
        CREATE TABLE [dbo].[PasswordEntries] (
          [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          [Title] NVARCHAR(200) NOT NULL,
          [Username] NVARCHAR(200) NULL,
          [Website] NVARCHAR(500) NULL,
          [Notes] NVARCHAR(MAX) NULL,
          [Category] NVARCHAR(100) NULL DEFAULT 'General',
          [Favorite] BIT NOT NULL DEFAULT 0,
          [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
          [CreatedBy] NVARCHAR(100) NULL DEFAULT 'system',
          [UpdatedBy] NVARCHAR(100) NULL DEFAULT 'system',
          [IsActive] BIT NOT NULL DEFAULT 1
        );
        
        -- Create indexes for performance
        CREATE INDEX [IX_PasswordEntries_Category] ON [dbo].[PasswordEntries]([Category]);
        CREATE INDEX [IX_PasswordEntries_Favorite] ON [dbo].[PasswordEntries]([Favorite]);
        CREATE INDEX [IX_PasswordEntries_CreatedAt] ON [dbo].[PasswordEntries]([CreatedAt]);
        
        PRINT 'PasswordEntries table created successfully';
      END
      ELSE
      BEGIN
        PRINT 'PasswordEntries table already exists';
      END
    `;

    try {
      await this.executeQuery(createTableQuery);
      console.log('✅ Password database initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing password database:', error);
      throw error;
    }
  }

  /**
   * Get all password entries (metadata only)
   * @returns Promise<PasswordEntry[]>
   */
  async getAllPasswords(): Promise<PasswordEntry[]> {
    const query = `
      SELECT 
        [Id] as id,
        [Title] as title,
        [Username] as username,
        [Website] as website,
        [Notes] as notes,
        [Category] as category,
        [Favorite] as favorite,
        [CreatedAt] as createdAt,
        [UpdatedAt] as updatedAt,
        [CreatedBy] as createdBy,
        [UpdatedBy] as updatedBy
      FROM [dbo].[PasswordEntries]
      WHERE [IsActive] = 1
      ORDER BY [UpdatedAt] DESC
    `;

    try {
      const results = await this.executeQuery(query);
      return results.map(row => ({
        id: row.id,
        title: row.title,
        username: row.username,
        website: row.website,
        notes: row.notes,
        category: row.category || 'General',
        favorite: row.favorite,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        createdBy: row.createdBy,
        updatedBy: row.updatedBy
      }));
    } catch (error) {
      console.error('❌ Error getting password entries:', error);
      throw error;
    }
  }

  /**
   * Get password entry by ID with decrypted password
   * @param passwordId Password entry ID
   * @returns Promise<PasswordEntry & { password?: string } | null>
   */
  async getPasswordById(passwordId: string): Promise<(PasswordEntry & { password?: string }) | null> {
    const query = `
      SELECT 
        [Id] as id,
        [Title] as title,
        [Username] as username,
        [Website] as website,
        [Notes] as notes,
        [Category] as category,
        [Favorite] as favorite,
        [CreatedAt] as createdAt,
        [UpdatedAt] as updatedAt,
        [CreatedBy] as createdBy,
        [UpdatedBy] as updatedBy
      FROM [dbo].[PasswordEntries]
      WHERE [Id] = @passwordId AND [IsActive] = 1
    `;

    const parameters = { passwordId };

    try {
      const results = await this.executeQuery(query, parameters);
      
      if (results.length === 0) {
        return null;
      }

      const row = results[0];
      const password = await this.getPasswordFromKeyVault(passwordId);

      return {
        id: row.id,
        title: row.title,
        username: row.username,
        website: row.website,
        notes: row.notes,
        category: row.category || 'General',
        favorite: row.favorite,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        password: password || undefined
      };
    } catch (error) {
      console.error('❌ Error getting password by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new password entry
   * @param passwordData Password creation data
   * @returns Promise<string> New password ID
   */
  async createPassword(passwordData: CreatePasswordRequest): Promise<string> {
    const passwordId = this.generateGuid();
    const pool = await this.getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // Store password in Key Vault first
      await this.storePasswordInKeyVault(passwordId, passwordData.password);

      // Insert metadata into database
      const insertQuery = `
        INSERT INTO [dbo].[PasswordEntries] 
          ([Id], [Title], [Username], [Website], [Notes], [Category], [Favorite], [CreatedBy], [UpdatedBy])
        VALUES 
          (@id, @title, @username, @website, @notes, @category, @favorite, @createdBy, @updatedBy)
      `;

      const request = new sql.Request(transaction);
      request.input('id', sql.UniqueIdentifier, passwordId);
      request.input('title', sql.NVarChar, passwordData.title);
      request.input('username', sql.NVarChar, passwordData.username || null);
      request.input('website', sql.NVarChar, passwordData.website || null);
      request.input('notes', sql.NVarChar, passwordData.notes || null);
      request.input('category', sql.NVarChar, passwordData.category || 'General');
      request.input('favorite', sql.Bit, passwordData.favorite || false);
      request.input('createdBy', sql.NVarChar, passwordData.createdBy || 'system');
      request.input('updatedBy', sql.NVarChar, passwordData.createdBy || 'system');

      await request.query(insertQuery);
      await transaction.commit();

      console.log(`✅ Password entry created successfully: ${passwordId}`);
      return passwordId;

    } catch (error) {
      await transaction.rollback();
      // Clean up Key Vault entry if database insert failed
      try {
        await this.deletePasswordFromKeyVault(passwordId);
      } catch (cleanupError) {
        console.error('❌ Error cleaning up Key Vault after failed create:', cleanupError);
      }
      console.error('❌ Error creating password entry:', error);
      throw error;
    }
  }

  /**
   * Update a password entry
   * @param passwordId Password entry ID
   * @param passwordData Updated password data
   * @returns Promise<boolean>
   */
  async updatePassword(passwordId: string, passwordData: UpdatePasswordRequest): Promise<boolean> {
    const pool = await this.getConnectionPool();

    try {
      // Check if password exists
      const existingPassword = await this.getPasswordById(passwordId);
      if (!existingPassword) {
        return false;
      }

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // Update password in Key Vault if provided
        if (passwordData.password) {
          await this.storePasswordInKeyVault(passwordId, passwordData.password);
        }

        // Build dynamic update query
        const updateFields = [];
        const parameters: { [key: string]: any } = { passwordId };

        if (passwordData.title !== undefined) {
          updateFields.push('[Title] = @title');
          parameters.title = passwordData.title;
        }
        if (passwordData.username !== undefined) {
          updateFields.push('[Username] = @username');
          parameters.username = passwordData.username;
        }
        if (passwordData.website !== undefined) {
          updateFields.push('[Website] = @website');
          parameters.website = passwordData.website;
        }
        if (passwordData.notes !== undefined) {
          updateFields.push('[Notes] = @notes');
          parameters.notes = passwordData.notes;
        }
        if (passwordData.category !== undefined) {
          updateFields.push('[Category] = @category');
          parameters.category = passwordData.category;
        }
        if (passwordData.favorite !== undefined) {
          updateFields.push('[Favorite] = @favorite');
          parameters.favorite = passwordData.favorite;
        }

        if (updateFields.length === 0 && !passwordData.password) {
          await transaction.rollback();
          return false;
        }

        if (updateFields.length > 0) {
          updateFields.push('[UpdatedAt] = GETUTCDATE()');
          updateFields.push('[UpdatedBy] = @updatedBy');
          parameters.updatedBy = passwordData.updatedBy || 'system';

          const updateQuery = `
            UPDATE [dbo].[PasswordEntries] 
            SET ${updateFields.join(', ')}
            WHERE [Id] = @passwordId AND [IsActive] = 1
          `;

          const request = new sql.Request(transaction);
          Object.keys(parameters).forEach(key => {
            request.input(key, parameters[key]);
          });

          await request.query(updateQuery);
        }

        await transaction.commit();
        console.log(`✅ Password entry updated successfully: ${passwordId}`);
        return true;

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('❌ Error updating password entry:', error);
      throw error;
    }
  }

  /**
   * Delete a password entry (soft delete)
   * @param passwordId Password entry ID
   * @returns Promise<boolean>
   */
  async deletePassword(passwordId: string): Promise<boolean> {
    const pool = await this.getConnectionPool();

    try {
      // Check if password exists
      const existingPassword = await this.getPasswordById(passwordId);
      if (!existingPassword) {
        return false;
      }

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // Soft delete from database
        const deleteQuery = `
          UPDATE [dbo].[PasswordEntries] 
          SET 
            [IsActive] = 0,
            [UpdatedAt] = GETUTCDATE(),
            [UpdatedBy] = 'system'
          WHERE [Id] = @passwordId AND [IsActive] = 1
        `;

        const request = new sql.Request(transaction);
        request.input('passwordId', sql.UniqueIdentifier, passwordId);

        const result = await request.query(deleteQuery);
        
        if (result.rowsAffected[0] > 0) {
          // Delete from Key Vault
          await this.deletePasswordFromKeyVault(passwordId);
          await transaction.commit();
          console.log(`✅ Password entry deleted successfully: ${passwordId}`);
          return true;
        } else {
          await transaction.rollback();
          return false;
        }

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('❌ Error deleting password entry:', error);
      throw error;
    }
  }
}