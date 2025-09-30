// Database service for tenant configuration management
// Uses SQL Server for configuration data and Azure Key Vault for secrets

import * as sql from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

export interface TenantConfig {
  id: string;
  tenantName: string;
  shortname?: string;          // NEW FIELD: Short name for URL routing and quick identification
  companyId: string;
  baseUrl: string;
  loginUrl?: string;           // NEW FIELD: Tenant-specific login URL  
  clockUrl?: string;           // NEW FIELD: Employee time clock/punch URL
  clientId: string;
  description?: string;
  isActive: boolean;
  createdDate: Date;
  modifiedDate?: Date;
  tokenEndpoint?: string;
  apiVersion?: string;
  scope?: string;
}

export interface CreateTenantRequest {
  tenantName: string;
  companyId: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  description?: string;
  shortname?: string;          // NEW FIELD: Short name for URL routing
  loginUrl?: string;           // NEW FIELD: Tenant-specific login URL
  clockUrl?: string;           // NEW FIELD: Employee time clock/punch URL
}

export interface UpdateTenantRequest {
  id: string;
  tenantName: string;
  companyId: string;
  baseUrl: string;
  clientId: string;
  clientSecret?: string;
  description?: string;
  shortname?: string;          // NEW FIELD: Short name for URL routing
  loginUrl?: string;           // NEW FIELD: Tenant-specific login URL  
  clockUrl?: string;           // NEW FIELD: Employee time clock/punch URL
  isActive?: boolean;
}

export interface ThirdPartyAPI {
  Id: string;
  Name: string;
  Description?: string;
  Category?: string;
  Provider: string;
  BaseUrl: string;
  Version?: string;
  AuthType: string;
  KeyVaultSecretName: string;
  ConfigurationJson?: string;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
  CreatedBy?: string;
  UpdatedBy?: string;
}

/**
 * Interface for UKG Employee Details data
 */
export interface UKGEmployeeDetails {
  tenantId: string;
  ukgEmployeeId: string;
  employeeNumber?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  displayName?: string;
  email?: string;
  personNumber?: string;
  status?: string;
  hireDate?: Date;
  terminationDate?: Date;
  lastWorkDate?: Date;
  statusDate?: Date;
  departmentId?: string;
  departmentName?: string;
  positionId?: string;
  positionTitle?: string;
  jobTitle?: string;
  payClass?: string;
  payGroup?: string;
  managerId?: string;
  managerName?: string;
  supervisorId?: string;
  supervisorName?: string;
  payRate?: number;
  payRateEffectiveDate?: Date;
  currency?: string;
  payFrequency?: string;
  costCenter_LocationId?: number;
  costCenter_LocationName?: string;
  costCenter_LocationCode?: string;
  costCenter_JobTitleId?: number;
  costCenter_JobTitleName?: string;
  costCenter_JobTitleCode?: string;
  costCenter_JobTitleParentId?: number;
  costCenter_JobTitleParentName?: string;
  locationId?: string;
  locationName?: string;
  homeLocationId?: string;
  workLocationId?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  personType?: string;
  employeeType?: string;
  workAssignment?: string;
  scheduleGroup?: string;
  timeZone?: string;
  rawUKGData?: string;
  costCenterRawData?: string;
}

/**
 * Interface for Cost Center data
 */
export interface CostCenter {
  costCenterId: number;
  name: string;
  code?: string;
  parentId?: number;
  level?: number;
  isActive?: boolean;
  rawData?: string;
}

export class TenantDatabaseService {
  private keyVaultClient: SecretClient;
  private credential: DefaultAzureCredential;
  private pool: sql.ConnectionPool | null = null;

  constructor() {
    // Initialize Azure credentials for Key Vault access
    // Use system-assigned managed identity (no clientId needed) for Azure Function Apps
    this.credential = new DefaultAzureCredential();
    
    // Initialize Key Vault client for secrets
    const keyVaultUrl = process.env.AZURE_KEY_VAULT_URL || process.env.AZURE_KEY_VAULT_ENDPOINT || 'https://mosaic-toolbox-kv.vault.azure.net/';
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

    // Use SQL authentication only
    this.pool = await this.createConnectionWithFallback();
    return this.pool;
  }

  /**
   * Create connection using SQL authentication only
   * @returns Promise<sql.ConnectionPool>
   */
  private async createConnectionWithFallback(): Promise<sql.ConnectionPool> {
    const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
    if (connectionString) {
      try {
        console.log('Attempting SQL authentication...');
        const sqlConfig = this.parseConnectionStringToConfig(connectionString);
        const sqlPool = new sql.ConnectionPool(sqlConfig);
        await sqlPool.connect();
        console.log('✅ Connected using SQL authentication');
        return sqlPool;
      } catch (sqlError: any) {
        console.error('❌ SQL authentication failed:', sqlError?.message || sqlError);
        throw new Error(`SQL authentication failed: ${sqlError?.message || sqlError}`);
      }
    } else {
      throw new Error('AZURE_SQL_CONNECTION_STRING is required for SQL authentication');
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
   * Execute a SQL query with typed parameters - public method for services
   * @param query SQL query string
   * @param parameters Array of parameters with type information
   * @returns Promise<any[]>
   */
  async executeQueryWithParams(query: string, parameters: Array<{name: string, type: string, value: any}> = []): Promise<any[]> {
    const pool = await this.getConnectionPool();
    const request = pool.request();
    
    // Add typed parameters to request
    parameters.forEach(param => {
      switch(param.type.toLowerCase()) {
        case 'uniqueidentifier':
          request.input(param.name, sql.UniqueIdentifier, param.value);
          break;
        case 'nvarchar':
          request.input(param.name, sql.NVarChar, param.value);
          break;
        case 'varchar':
          request.input(param.name, sql.VarChar, param.value);
          break;
        case 'int':
          request.input(param.name, sql.Int, param.value);
          break;
        case 'bit':
          request.input(param.name, sql.Bit, param.value);
          break;
        case 'datetime2':
          request.input(param.name, sql.DateTime2, param.value);
          break;
        default:
          request.input(param.name, param.value);
      }
    });

    const result = await request.query(query);
    
    // For UPDATE/INSERT/DELETE queries, we need to return metadata about rows affected
    // We'll add this information to the result array for backward compatibility
    const recordset = result.recordset || [];
    
    // Add rowsAffected information to the result for UPDATE/INSERT/DELETE operations
    if (result.rowsAffected && result.rowsAffected.length > 0) {
      // Add the rowsAffected info as a property on the array
      (recordset as any).rowsAffected = result.rowsAffected[0];
    }
    
    return recordset;
  }

  /**
   * Get all active UKGTenants with UKG configuration
   * @returns Promise<TenantConfig[]>
   */
  async getAllTenants(): Promise<TenantConfig[]> {
    const query = `
      SELECT 
        t.Id as id,
        t.TenantName as tenantName,
        t.CompanyId as companyId,
        t.BaseUrl as baseUrl,
        t.ClientId as clientId,
        t.Description as description,
        t.IsActive as isActive,
        t.CreatedDate as createdDate,
        t.ModifiedDate as modifiedDate,
        t.BaseUrl + '/ta/rest/v2/companies/' + t.CompanyId + '/oauth2/token' as tokenEndpoint,
        'v2' as apiVersion,
        'employee_management' as scope
      FROM [dbo].[UKGTenants] t
      WHERE t.IsActive = 1
      ORDER BY t.TenantName
    `;

    const results = await this.executeQuery(query);
    return results.map(row => ({
      id: row.id,
      tenantName: row.tenantName,
      companyId: row.companyId,
      baseUrl: row.baseUrl,
      clientId: row.clientId,
      description: row.description,
      isActive: row.isActive,
      createdDate: row.createdDate,
      modifiedDate: row.modifiedDate,
      tokenEndpoint: row.tokenEndpoint,
      apiVersion: row.apiVersion,
      scope: row.scope
    }));
  }

  /**
   * Get tenant by ID
   * @param tenantId Tenant ID
   * @returns Promise<TenantConfig | null>
   */
  async getTenantById(tenantId: string): Promise<TenantConfig | null> {
    const query = `
      SELECT 
        t.Id as id,
        t.TenantName as tenantName,
        t.CompanyId as companyId,
        t.BaseUrl as baseUrl,
        t.ClientId as clientId,
        t.Description as description,
        t.IsActive as isActive,
        t.CreatedDate as createdDate,
        t.ModifiedDate as modifiedDate,
        t.BaseUrl + '/ta/rest/v2/companies/' + t.CompanyId + '/oauth2/token' as tokenEndpoint,
        'v2' as apiVersion,
        'employee_management' as scope
      FROM [dbo].[UKGTenants] t
      WHERE t.Id = @tenantId AND t.IsActive = 1
    `;

    const parameters = { tenantId };
    const results = await this.executeQuery(query, parameters);
    
    if (results.length === 0) return null;

    const row = results[0];
    return {
      id: row.id,
      tenantName: row.tenantName,
      companyId: row.companyId,
      baseUrl: row.baseUrl,
      clientId: row.clientId,
      description: row.description,
      isActive: row.isActive,
      createdDate: row.createdDate,
      modifiedDate: row.modifiedDate,
      tokenEndpoint: row.tokenEndpoint,
      apiVersion: row.apiVersion,
      scope: row.scope
    };
  }

  /**
   * Create a new tenant
   * @param tenantData Tenant configuration data
   * @returns Promise<string> New tenant ID
   */
  async createTenant(tenantData: CreateTenantRequest): Promise<string> {
    const tenantId = this.generateGuid();
    const pool = await this.getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // Insert tenant configuration
      const insertTenantQuery = `
        INSERT INTO [dbo].[UKGTenants] 
          ([Id], [TenantName], [CompanyId], [BaseUrl], [ClientId], [Description], [CreatedBy])
        VALUES 
          (@id, @tenantName, @companyId, @baseUrl, @clientId, @description, @createdBy)
      `;

      const tenantRequest = new sql.Request(transaction);
      tenantRequest.input('id', sql.UniqueIdentifier, tenantId);
      tenantRequest.input('tenantName', sql.NVarChar, tenantData.tenantName);
      tenantRequest.input('companyId', sql.NVarChar, tenantData.companyId);
      tenantRequest.input('baseUrl', sql.NVarChar, tenantData.baseUrl);
      tenantRequest.input('clientId', sql.NVarChar, tenantData.clientId);
      tenantRequest.input('description', sql.NVarChar, tenantData.description || '');
      tenantRequest.input('createdBy', sql.NVarChar, 'system');

      await tenantRequest.query(insertTenantQuery);

      // UKG API configuration is now built dynamically from UKGTenants table
      // No separate UKGApiConfigurations table needed

      // Store client secret in Key Vault
      await this.storeClientSecret(tenantId, tenantData.clientSecret);

      // Audit the creation
      await this.auditTenantChange(tenantId, 'CREATE', '', 
        `TenantName:${tenantData.tenantName}; CompanyId:${tenantData.companyId}; BaseUrl:${tenantData.baseUrl}`, 
        'system');

      await transaction.commit();
      return tenantId;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Update an existing tenant
   * @param tenantData Updated tenant data
   * @returns Promise<boolean>
   */
  async updateTenant(tenantData: UpdateTenantRequest): Promise<boolean> {
    const pool = await this.getConnectionPool();

    try {
      // Get old values for audit
      const oldTenant = await this.getTenantById(tenantData.id);
      if (!oldTenant) return false;

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        // Update tenant configuration
        const updateTenantQuery = `
          UPDATE [dbo].[UKGTenants] 
          SET 
            [TenantName] = @tenantName,
            [CompanyId] = @companyId,
            [BaseUrl] = @baseUrl,
            [ClientId] = @clientId,
            [Description] = @description,
            [IsActive] = @isActive,
            [ModifiedBy] = @modifiedBy,
            [ModifiedDate] = GETUTCDATE()
          WHERE [Id] = @id
        `;

        const tenantRequest = new sql.Request(transaction);
        tenantRequest.input('id', sql.UniqueIdentifier, tenantData.id);
        tenantRequest.input('tenantName', sql.NVarChar, tenantData.tenantName);
        tenantRequest.input('companyId', sql.NVarChar, tenantData.companyId);
        tenantRequest.input('baseUrl', sql.NVarChar, tenantData.baseUrl);
        tenantRequest.input('clientId', sql.NVarChar, tenantData.clientId);
        tenantRequest.input('description', sql.NVarChar, tenantData.description || '');
        tenantRequest.input('isActive', sql.Bit, tenantData.isActive !== undefined ? tenantData.isActive : true);
        tenantRequest.input('modifiedBy', sql.NVarChar, 'system');

        await tenantRequest.query(updateTenantQuery);

        // UKG configuration is now built dynamically from UKGTenants table
        // No separate UKGApiConfigurations table to update

        // Update client secret if provided
        if (tenantData.clientSecret) {
          await this.storeClientSecret(tenantData.id, tenantData.clientSecret);
        }

        // Audit the update
        const oldValues = `TenantName:${oldTenant.tenantName}; CompanyId:${oldTenant.companyId}; BaseUrl:${oldTenant.baseUrl}`;
        const newValues = `TenantName:${tenantData.tenantName}; CompanyId:${tenantData.companyId}; BaseUrl:${tenantData.baseUrl}`;
        await this.auditTenantChange(tenantData.id, 'UPDATE', oldValues, newValues, 'system');

        await transaction.commit();
        return true;

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Update tenant error:', error);
      return false;
    }
  }

  /**
   * Delete a tenant (soft delete)
   * @param tenantId Tenant ID to delete
   * @returns Promise<boolean>
   */
  async deleteTenant(tenantId: string): Promise<boolean> {
    const query = `
      UPDATE [dbo].[UKGTenants] 
      SET 
        [IsActive] = 0,
        [ModifiedBy] = @modifiedBy,
        [ModifiedDate] = GETUTCDATE()
      WHERE [Id] = @tenantId;
      
      -- UKG configuration is now handled in UKGTenants table;
    `;

    const parameters = { 
      tenantId, 
      modifiedBy: 'system' 
    };

    await this.executeQuery(query, parameters);
    await this.auditTenantChange(tenantId, 'DELETE', '', '', 'system');
    
    return true;
  }

  /**
   * Get client secret from Key Vault
   * @param tenantId Tenant ID
   * @returns Promise<string | null>
   */
  async getClientSecret(tenantId: string): Promise<string | null> {
    try {
      const secretName = `tenant-${tenantId}-client-secret`;
      const secret = await this.keyVaultClient.getSecret(secretName);
      return secret.value || null;
    } catch (error) {
      console.error(`Error retrieving client secret for tenant ${tenantId}:`, error);
      return null;
    }
  }

  /**
   * Store client secret in Key Vault
   * @param tenantId Tenant ID
   * @param clientSecret Client secret value
   * @returns Promise<void>
   */
  private async storeClientSecret(tenantId: string, clientSecret: string): Promise<void> {
    try {
      const secretName = `tenant-${tenantId}-client-secret`;
      await this.keyVaultClient.setSecret(secretName, clientSecret);
    } catch (error) {
      console.error(`Error storing client secret for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Store SFTP private key in Key Vault
   * @param tenantId Tenant ID
   * @param configId Configuration ID
   * @param privateKey Private key content
   * @returns Promise<void>
   */
  async storeSftpPrivateKey(tenantId: string, configId: string, privateKey: string): Promise<void> {
    try {
      const secretName = `sftp-${configId}-privatekey`;
      await this.keyVaultClient.setSecret(secretName, privateKey);
    } catch (error) {
      console.error(`Error storing SFTP private key for config ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Store SFTP password in Key Vault
   * @param tenantId Tenant ID
   * @param configId Configuration ID
   * @param password Password content
   * @returns Promise<void>
   */
  async storeSftpPassword(tenantId: string, configId: string, password: string): Promise<void> {
    try {
      const secretName = `sftp-${configId}-password`;
      await this.keyVaultClient.setSecret(secretName, password);
    } catch (error) {
      console.error(`Error storing SFTP password for config ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Get SFTP password from Key Vault
   * @param tenantId Tenant ID
   * @param configId Configuration ID
   * @returns Promise<string | null>
   */
  async getSftpPassword(tenantId: string, configId: string): Promise<string | null> {
    try {
      const secretName = `sftp-${configId}-password`;
      const secret = await this.keyVaultClient.getSecret(secretName);
      return secret.value || null;
    } catch (error) {
      console.error(`Error retrieving SFTP password for config ${configId}:`, error);
      return null;
    }
  }

  /**
   * Get SFTP private key from Key Vault
   * @param tenantId Tenant ID
   * @param configId Configuration ID
   * @returns Promise<string | null>
   */
  async getSftpPrivateKey(tenantId: string, configId: string): Promise<string | null> {
    try {
      const secretName = `sftp-${configId}-privatekey`;
      const secret = await this.keyVaultClient.getSecret(secretName);
      return secret.value || null;
    } catch (error) {
      console.error(`Error retrieving SFTP private key for config ${configId}:`, error);
      return null;
    }
  }

  /**
   * Get secret from Key Vault by exact secret name
   * @param secretName The exact name of the secret in Key Vault
   * @returns Promise<string | null>
   */
  async getSecretByName(secretName: string): Promise<string | null> {
    try {
      const secret = await this.keyVaultClient.getSecret(secretName);
      return secret.value || null;
    } catch (error) {
      console.error(`Error retrieving secret ${secretName}:`, error);
      return null;
    }
  }

  /**
   * Store SharePoint client secret in Key Vault
   * @param tenantId Tenant ID
   * @param configId Configuration ID
   * @param clientSecret Client secret content
   * @returns Promise<void>
   */
  async storeSharePointClientSecret(tenantId: string, configId: string, clientSecret: string): Promise<void> {
    try {
      const secretName = `sharepoint-${configId}-clientsecret`;
      await this.keyVaultClient.setSecret(secretName, clientSecret);
    } catch (error) {
      console.error(`Error storing SharePoint client secret for config ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Get SharePoint client secret from Key Vault
   * @param tenantId Tenant ID
   * @param configId Configuration ID
   * @returns Promise<string | null>
   */
  async getSharePointClientSecret(tenantId: string, configId: string): Promise<string | null> {
    try {
      const secretName = `sharepoint-${configId}-clientsecret`;
      const secret = await this.keyVaultClient.getSecret(secretName);
      return secret.value || null;
    } catch (error) {
      console.error(`Error retrieving SharePoint client secret for config ${configId}:`, error);
      return null;
    }
  }

  /**
   * Update SharePoint client secret in Key Vault
   * @param tenantId Tenant ID
   * @param secretName The Key Vault secret name
   * @param clientSecret New client secret content
   * @returns Promise<void>
   */
  async updateSharePointClientSecret(tenantId: string, secretName: string, clientSecret: string): Promise<void> {
    try {
      await this.keyVaultClient.setSecret(secretName, clientSecret);
    } catch (error) {
      console.error(`Error updating SharePoint client secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Store secret in Key Vault
   * @param secretName The name of the secret to store
   * @param secretValue The value to store
   * @returns Promise<void>
   */
  async storeSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      await this.keyVaultClient.setSecret(secretName, secretValue);
    } catch (error) {
      console.error(`Error storing secret ${secretName}:`, error);
      throw error;
    }
  }

  /**
   * Audit tenant changes
   * @param tenantId Tenant ID
   * @param action Action performed
   * @param oldValues Old values
   * @param newValues New values
   * @param changedBy User who made the change
   * @returns Promise<void>
   */
  private async auditTenantChange(tenantId: string, action: string, oldValues: string, newValues: string, changedBy: string): Promise<void> {
    const query = `
      INSERT INTO [dbo].[UKGTenantAudit] 
        ([TenantId], [Action], [OldValues], [NewValues], [ChangedBy])
      VALUES 
        (@tenantId, @action, @oldValues, @newValues, @changedBy)
    `;

    const parameters = {
      tenantId,
      action,
      oldValues,
      newValues,
      changedBy
    };

    await this.executeQuery(query, parameters);
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

  // ===== ThirdPartyAPI Methods =====

  /**
   * Test database connection for ThirdPartyAPI operations
   */
  async testThirdPartyAPIConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const pool = await this.getConnectionPool();
      const request = pool.request();
      const result = await request.query('SELECT GETDATE() as CurrentTime');
      
      console.log(`ThirdPartyAPI DB Test Result: CurrentTime = ${result.recordset[0]?.CurrentTime}`);
      return {
        success: true,
        message: 'Database connection successful',
        details: {
          server: process.env.SQL_SERVER || 'mosaic.database.windows.net',
          database: process.env.SQL_DATABASE || 'moevocorp',
          currentTime: result.recordset[0]?.CurrentTime
        }
      };
    } catch (error: any) {
      console.error('ThirdPartyAPI Database test failed:', error);
      return { success: false, message: error?.message || error };
    }
  }

  /**
   * Create or update ThirdPartyAPI (upsert operation)
   */
  async createOrUpdateThirdPartyAPI(apiData: {
    Name: string;
    Description?: string;
    Category?: string;
    Provider: string;
    BaseUrl: string;
    Version?: string;
    AuthType: string;
    KeyVaultSecretName: string;
    ConfigurationJson?: string;
    CreatedBy?: string;
    UpdatedBy?: string;
  }): Promise<string> {
    // First check if an API with this provider and name already exists
    const existingQuery = `
      SELECT [Id] FROM [dbo].[ThirdPartyAPIs]
      WHERE [Provider] = @provider AND [Name] = @name AND [IsActive] = 1
    `;
    
    const existingParams = {
      provider: apiData.Provider,
      name: apiData.Name
    };
    
    const existing = await this.executeQuery(existingQuery, existingParams);
    
    if (existing.length > 0) {
      // Update existing record
      const existingId = existing[0].Id;
      const updateSuccess = await this.updateThirdPartyAPI(existingId, {
        Description: apiData.Description,
        Category: apiData.Category,
        BaseUrl: apiData.BaseUrl,
        Version: apiData.Version,
        AuthType: apiData.AuthType,
        KeyVaultSecretName: apiData.KeyVaultSecretName,
        ConfigurationJson: apiData.ConfigurationJson,
        UpdatedBy: apiData.UpdatedBy || apiData.CreatedBy || 'system'
      });
      
      if (updateSuccess) {
        return existingId;
      } else {
        throw new Error('Failed to update existing ThirdPartyAPI');
      }
    } else {
      // Create new record
      return await this.createThirdPartyAPI(apiData);
    }
  }

  /**
   * Create a new ThirdPartyAPI
   */
  async createThirdPartyAPI(apiData: {
    Name: string;
    Description?: string;
    Category?: string;
    Provider: string;
    BaseUrl: string;
    Version?: string;
    AuthType: string;
    KeyVaultSecretName: string;
    ConfigurationJson?: string;
    CreatedBy?: string;
    UpdatedBy?: string;
  }): Promise<string> {
    const id = this.generateGuid();
    
    const query = `
      INSERT INTO [dbo].[ThirdPartyAPIs] (
        [Id], [Name], [Description], [Category], [Provider], [BaseUrl], 
        [Version], [AuthType], [KeyVaultSecretName], [ConfigurationJson], 
        [CreatedBy], [UpdatedBy], [IsActive]
      ) VALUES (
        @id, @name, @description, @category, @provider, @baseUrl,
        @version, @authType, @keyVaultSecretName, @configurationJson,
        @createdBy, @updatedBy, 1
      )
    `;

    const parameters = {
      id,
      name: apiData.Name,
      description: apiData.Description || null,
      category: apiData.Category || null,
      provider: apiData.Provider,
      baseUrl: apiData.BaseUrl,
      version: apiData.Version || null,
      authType: apiData.AuthType,
      keyVaultSecretName: apiData.KeyVaultSecretName,
      configurationJson: apiData.ConfigurationJson && apiData.ConfigurationJson !== "undefined" ? apiData.ConfigurationJson : null,
      createdBy: apiData.CreatedBy || 'system',
      updatedBy: apiData.UpdatedBy || apiData.CreatedBy || 'system'
    };

    await this.executeQuery(query, parameters);
    return id;
  }

  /**
   * Get all ThirdPartyAPIs
   */
  async getAllThirdPartyAPIs(): Promise<ThirdPartyAPI[]> {
    const query = `
      SELECT 
        [Id], [Name], [Description], [Category], [Provider], [BaseUrl],
        [Version], [AuthType], [KeyVaultSecretName], [ConfigurationJson],
        [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy]
      FROM [dbo].[ThirdPartyAPIs]
      WHERE [IsActive] = 1
      ORDER BY [Name]
    `;

    const results = await this.executeQuery(query);
    return results.map(row => ({
      Id: row.Id,
      Name: row.Name,
      Description: row.Description,
      Category: row.Category,
      Provider: row.Provider,
      BaseUrl: row.BaseUrl,
      Version: row.Version,
      AuthType: row.AuthType,
      KeyVaultSecretName: row.KeyVaultSecretName,
      ConfigurationJson: row.ConfigurationJson,
      IsActive: row.IsActive,
      CreatedAt: row.CreatedAt,
      UpdatedAt: row.UpdatedAt,
      CreatedBy: row.CreatedBy,
      UpdatedBy: row.UpdatedBy
    }));
  }

  /**
   * Get ThirdPartyAPI by ID
   */
  async getThirdPartyAPIById(id: string): Promise<ThirdPartyAPI | null> {
    const query = `
      SELECT 
        [Id], [Name], [Description], [Category], [Provider], [BaseUrl],
        [Version], [AuthType], [KeyVaultSecretName], [ConfigurationJson],
        [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy]
      FROM [dbo].[ThirdPartyAPIs]
      WHERE [Id] = @id AND [IsActive] = 1
    `;

    const parameters = { id };
    const results = await this.executeQuery(query, parameters);
    
    if (results.length === 0) return null;

    const row = results[0];
    return {
      Id: row.Id,
      Name: row.Name,
      Description: row.Description,
      Category: row.Category,
      Provider: row.Provider,
      BaseUrl: row.BaseUrl,
      Version: row.Version,
      AuthType: row.AuthType,
      KeyVaultSecretName: row.KeyVaultSecretName,
      ConfigurationJson: row.ConfigurationJson,
      IsActive: row.IsActive,
      CreatedAt: row.CreatedAt,
      UpdatedAt: row.UpdatedAt,
      CreatedBy: row.CreatedBy,
      UpdatedBy: row.UpdatedBy
    };
  }

  /**
   * Get ThirdPartyAPIs by Provider
   */
  async getThirdPartyAPIsByProvider(provider: string): Promise<ThirdPartyAPI[]> {
    const query = `
      SELECT 
        [Id], [Name], [Description], [Category], [Provider], [BaseUrl],
        [Version], [AuthType], [KeyVaultSecretName], [ConfigurationJson],
        [IsActive], [CreatedAt], [UpdatedAt], [CreatedBy], [UpdatedBy]
      FROM [dbo].[ThirdPartyAPIs]
      WHERE [Provider] = @provider AND [IsActive] = 1
      ORDER BY [Name]
    `;

    const parameters = { provider };
    const results = await this.executeQuery(query, parameters);
    return results.map(row => ({
      Id: row.Id,
      Name: row.Name,
      Description: row.Description,
      Category: row.Category,
      Provider: row.Provider,
      BaseUrl: row.BaseUrl,
      Version: row.Version,
      AuthType: row.AuthType,
      KeyVaultSecretName: row.KeyVaultSecretName,
      ConfigurationJson: row.ConfigurationJson,
      IsActive: row.IsActive,
      CreatedAt: row.CreatedAt,
      UpdatedAt: row.UpdatedAt,
      CreatedBy: row.CreatedBy,
      UpdatedBy: row.UpdatedBy
    }));
  }

  /**
   * Update ThirdPartyAPI
   */
  async updateThirdPartyAPI(id: string, apiData: {
    Name?: string;
    Description?: string;
    Category?: string;
    Provider?: string;
    BaseUrl?: string;
    Version?: string;
    AuthType?: string;
    KeyVaultSecretName?: string;
    ConfigurationJson?: string;
    UpdatedBy?: string;
  }): Promise<boolean> {
    const pool = await this.getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const updateFields = [];
      const parameters: { [key: string]: any } = { id };

      if (apiData.Name !== undefined) {
        updateFields.push('[Name] = @name');
        parameters.name = apiData.Name;
      }
      if (apiData.Description !== undefined) {
        updateFields.push('[Description] = @description');
        parameters.description = apiData.Description;
      }
      if (apiData.Category !== undefined) {
        updateFields.push('[Category] = @category');
        parameters.category = apiData.Category;
      }
      if (apiData.Provider !== undefined) {
        updateFields.push('[Provider] = @provider');
        parameters.provider = apiData.Provider;
      }
      if (apiData.BaseUrl !== undefined) {
        updateFields.push('[BaseUrl] = @baseUrl');
        parameters.baseUrl = apiData.BaseUrl;
      }
      if (apiData.Version !== undefined) {
        updateFields.push('[Version] = @version');
        parameters.version = apiData.Version;
      }
      if (apiData.AuthType !== undefined) {
        updateFields.push('[AuthType] = @authType');
        parameters.authType = apiData.AuthType;
      }
      if (apiData.KeyVaultSecretName !== undefined) {
        updateFields.push('[KeyVaultSecretName] = @keyVaultSecretName');
        parameters.keyVaultSecretName = apiData.KeyVaultSecretName;
      }
      if (apiData.ConfigurationJson !== undefined) {
        updateFields.push('[ConfigurationJson] = @configurationJson');
        parameters.configurationJson = apiData.ConfigurationJson && apiData.ConfigurationJson !== "undefined" ? apiData.ConfigurationJson : null;
      }

      if (updateFields.length === 0) {
        await transaction.rollback();
        return false;
      }

      updateFields.push('[UpdatedAt] = GETUTCDATE()');
      updateFields.push('[UpdatedBy] = @updatedBy');
      parameters.updatedBy = apiData.UpdatedBy || 'system';

      const query = `
        UPDATE [dbo].[ThirdPartyAPIs] 
        SET ${updateFields.join(', ')}
        WHERE [Id] = @id AND [IsActive] = 1
      `;

      const request = new sql.Request(transaction);
      Object.keys(parameters).forEach(key => {
        request.input(key, parameters[key]);
      });

      const result = await request.query(query);
      await transaction.commit();

      return result.rowsAffected[0] > 0;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Clean up invalid ConfigurationJson values (fix "undefined" strings)
   */
  async cleanupConfigurationJson(): Promise<{ success: boolean; message: string; updated: number }> {
    try {
      const query = `
        UPDATE [dbo].[ThirdPartyAPIs] 
        SET [ConfigurationJson] = NULL
        WHERE [ConfigurationJson] IN ('undefined', 'null', '') 
          OR [ConfigurationJson] IS NULL
      `;

      const pool = await this.getConnectionPool();
      const request = pool.request();
      const result = await request.query(query);
      
      return {
        success: true,
        message: 'Successfully cleaned up invalid ConfigurationJson values',
        updated: result.rowsAffected[0] || 0
      };
    } catch (error: any) {
      console.error('Failed to cleanup ConfigurationJson:', error);
      return { success: false, message: error?.message || error, updated: 0 };
    }
  }

  /**
   * Delete ThirdPartyAPI (soft delete)
   */
  async deleteThirdPartyAPI(id: string, deletedBy?: string): Promise<boolean> {
    const query = `
      UPDATE [dbo].[ThirdPartyAPIs] 
      SET 
        [IsActive] = 0,
        [UpdatedAt] = GETUTCDATE(),
        [UpdatedBy] = @updatedBy
      WHERE [Id] = @id AND [IsActive] = 1
    `;

    const parameters = { 
      id, 
      updatedBy: deletedBy || 'system' 
    };

    await this.executeQuery(query, parameters);
    return true;
  }

  // TenantEndpoints Methods

  /**
   * Get all endpoints for a tenant
   */
  async getTenantEndpoints(_tenantId: string): Promise<any[]> {
    // Return all shared endpoints - all UKGTenants have access to all endpoints
    const query = `
      SELECT 
        [Id],
        [EndpointId],
        [Name],
        [Description],
        [Category],
        [Path],
        [Method],
        [Version],
        [RequestTemplate],
        [HeadersJson],
        [AuthRequired],
        [Scope],
        [IsActive],
        [CreatedAt]
      FROM [dbo].[UKGTenantEndpoints] 
      WHERE [IsActive] = 1
      ORDER BY [Category], [Name]
    `;

    const result = await this.executeQuery(query, {});
    return result;
  }

  /**
   * Get a specific tenant endpoint by ID
   */
  async getTenantEndpointById(endpointId: string): Promise<any | null> {
    const query = `
      SELECT 
        [Id],
        [TenantId],
        [EndpointId],
        [Name],
        [Description],
        [Category],
        [Path],
        [Method],
        [Version],
        [RequestTemplate],
        [HeadersJson],
        [AuthRequired],
        [Scope],
        [IsActive],
        [CreatedAt]
      FROM [dbo].[UKGTenantEndpoints] 
      WHERE [Id] = @endpointId AND [IsActive] = 1
    `;

    const parameters = { endpointId };
    const result = await this.executeQuery(query, parameters);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Create a new tenant endpoint
   */
  async createTenantEndpoint(endpointData: {
    tenantId: string; // Not used in shared endpoints but kept for compatibility
    endpointId: string;
    name: string;
    description?: string;
    category: string;
    path: string;
    method: string;
    version: string;
    requestTemplate?: string;
    headersJson?: string;
    authRequired: boolean;
    scope?: string;
  }): Promise<any> {
    const pool = await this.getConnectionPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();

      const insertQuery = `
        INSERT INTO [dbo].[UKGTenantEndpoints] (
          [EndpointId], [Name], [Description], [Category], 
          [Path], [Method], [Version], [RequestTemplate], [HeadersJson], 
          [AuthRequired], [Scope], [IsActive], [CreatedAt]
        )
        OUTPUT INSERTED.*
        VALUES (
          @endpointId, @name, @description, @category,
          @path, @method, @version, @requestTemplate, @headersJson,
          @authRequired, @scope, 1, GETUTCDATE()
        )
      `;

      const request = new sql.Request(transaction);
      request.input('endpointId', sql.NVarChar, endpointData.endpointId);
      request.input('name', sql.NVarChar, endpointData.name);
      request.input('description', sql.NVarChar, endpointData.description || null);
      request.input('category', sql.NVarChar, endpointData.category);
      request.input('path', sql.NVarChar, endpointData.path);
      request.input('method', sql.NVarChar, endpointData.method);
      request.input('version', sql.NVarChar, endpointData.version);
      request.input('requestTemplate', sql.NVarChar, endpointData.requestTemplate || null);
      request.input('headersJson', sql.NVarChar, endpointData.headersJson || null);
      request.input('authRequired', sql.Bit, endpointData.authRequired);
      request.input('scope', sql.NVarChar, endpointData.scope || null);

      const result = await request.query(insertQuery);
      await transaction.commit();

      return result.recordset[0];
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Update a tenant endpoint
   */
  async updateTenantEndpoint(endpointId: string, endpointData: any): Promise<any> {
    const pool = await this.getConnectionPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();

      const updateFields = [];
      const parameters: any = { endpointId };

      if (endpointData.name !== undefined) {
        updateFields.push('[Name] = @name');
        parameters.name = endpointData.name;
      }
      if (endpointData.description !== undefined) {
        updateFields.push('[Description] = @description');
        parameters.description = endpointData.description;
      }
      if (endpointData.category !== undefined) {
        updateFields.push('[Category] = @category');
        parameters.category = endpointData.category;
      }
      if (endpointData.path !== undefined) {
        updateFields.push('[Path] = @path');
        parameters.path = endpointData.path;
      }
      if (endpointData.method !== undefined) {
        updateFields.push('[Method] = @method');
        parameters.method = endpointData.method;
      }
      if (endpointData.version !== undefined) {
        updateFields.push('[Version] = @version');
        parameters.version = endpointData.version;
      }
      if (endpointData.requestTemplate !== undefined) {
        updateFields.push('[RequestTemplate] = @requestTemplate');
        parameters.requestTemplate = endpointData.requestTemplate;
      }
      if (endpointData.headersJson !== undefined) {
        updateFields.push('[HeadersJson] = @headersJson');
        parameters.headersJson = endpointData.headersJson;
      }
      if (endpointData.authRequired !== undefined) {
        updateFields.push('[AuthRequired] = @authRequired');
        parameters.authRequired = endpointData.authRequired;
      }
      if (endpointData.scope !== undefined) {
        updateFields.push('[Scope] = @scope');
        parameters.scope = endpointData.scope;
      }
      if (endpointData.isActive !== undefined) {
        updateFields.push('[IsActive] = @isActive');
        parameters.isActive = endpointData.isActive;
      }

      if (updateFields.length === 0) {
        await transaction.rollback();
        return null;
      }

      const query = `
        UPDATE [dbo].[UKGTenantEndpoints] 
        SET ${updateFields.join(', ')}
        OUTPUT INSERTED.*
        WHERE [Id] = @endpointId AND [IsActive] = 1
      `;

      const request = new sql.Request(transaction);
      Object.keys(parameters).forEach(key => {
        request.input(key, parameters[key]);
      });

      const result = await request.query(query);
      await transaction.commit();

      return result.recordset[0];
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Delete a tenant endpoint (soft delete)
   */
  async deleteTenantEndpoint(endpointId: string): Promise<boolean> {
    const query = `
      UPDATE [dbo].[TenantEndpoints] 
      SET [IsActive] = 0
      WHERE [Id] = @endpointId
    `;

    const parameters = { endpointId };
    await this.executeQuery(query, parameters);
    return true;
  }

  // =============================================================================
  // UKG EMPLOYEE DETAILS METHODS
  // =============================================================================

  /**
   * Upsert UKG employee details using the stored procedure
   */
  async upsertUKGEmployeeDetails(employee: UKGEmployeeDetails): Promise<any> {
    const pool = await this.getConnectionPool();
    const request = new sql.Request(pool);

    try {
      // Set input parameters for the stored procedure
      request.input('TenantId', sql.UniqueIdentifier, employee.tenantId);
      request.input('UKGEmployeeId', sql.NVarChar(50), employee.ukgEmployeeId);
      request.input('EmployeeNumber', sql.NVarChar(50), employee.employeeNumber || null);
      request.input('FirstName', sql.NVarChar(100), employee.firstName);
      request.input('LastName', sql.NVarChar(100), employee.lastName);
      request.input('FullName', sql.NVarChar(200), employee.fullName || null);
      request.input('Email', sql.NVarChar(255), employee.email || null);
      request.input('Status', sql.NVarChar(50), employee.status || 'Active');
      request.input('HireDate', sql.Date, employee.hireDate || null);
      request.input('TerminationDate', sql.Date, employee.terminationDate || null);
      request.input('DepartmentId', sql.NVarChar(50), employee.departmentId || null);
      request.input('DepartmentName', sql.NVarChar(200), employee.departmentName || null);
      request.input('PositionId', sql.NVarChar(50), employee.positionId || null);
      request.input('PositionTitle', sql.NVarChar(200), employee.positionTitle || null);
      request.input('PayRate', sql.Decimal(10, 4), employee.payRate || null);
      request.input('CostCenter_LocationId', sql.BigInt, employee.costCenter_LocationId || null);
      request.input('CostCenter_LocationName', sql.NVarChar(200), employee.costCenter_LocationName || null);
      request.input('CostCenter_JobTitleId', sql.BigInt, employee.costCenter_JobTitleId || null);
      request.input('CostCenter_JobTitleName', sql.NVarChar(200), employee.costCenter_JobTitleName || null);
      request.input('CostCenter_JobTitleParentId', sql.BigInt, employee.costCenter_JobTitleParentId || null);
      request.input('CostCenter_JobTitleParentName', sql.NVarChar(200), employee.costCenter_JobTitleParentName || null);
      request.input('LocationId', sql.NVarChar(50), employee.locationId || null);
      request.input('LocationName', sql.NVarChar(200), employee.locationName || null);
      request.input('RawUKGData', sql.NVarChar(sql.MAX), employee.rawUKGData || null);
      request.input('CostCenterRawData', sql.NVarChar(sql.MAX), employee.costCenterRawData || null);

      const result = await request.execute('dbo.UpsertUKGEmployeeDetails');
      return result.recordset[0];
    } catch (error) {
      console.error('Error upserting UKG employee details:', error);
      throw error;
    }
  }

  /**
   * Get UKG employees by tenant with filtering options
   */
  async getUKGEmployeesByTenant(
    tenantId: string,
    filters?: {
      status?: string;
      departmentId?: string;
      costCenter_LocationId?: number;
      costCenter_JobTitleId?: number;
      costCenter_JobTitleParentId?: number;
      includeInactive?: boolean;
    }
  ): Promise<any[]> {
    const pool = await this.getConnectionPool();
    const request = new sql.Request(pool);

    try {
      request.input('TenantId', sql.UniqueIdentifier, tenantId);
      request.input('Status', sql.NVarChar(50), filters?.status || null);
      request.input('DepartmentId', sql.NVarChar(50), filters?.departmentId || null);
      request.input('CostCenter_LocationId', sql.BigInt, filters?.costCenter_LocationId || null);
      request.input('CostCenter_JobTitleId', sql.BigInt, filters?.costCenter_JobTitleId || null);
      request.input('CostCenter_JobTitleParentId', sql.BigInt, filters?.costCenter_JobTitleParentId || null);
      request.input('IncludeInactive', sql.Bit, filters?.includeInactive || false);

      const result = await request.execute('dbo.GetUKGEmployeesByTenant');
      return result.recordset;
    } catch (error) {
      console.error('Error getting UKG employees by tenant:', error);
      throw error;
    }
  }

  /**
   * Get UKG employee by ID
   */
  async getUKGEmployeeById(tenantId: string, ukgEmployeeId: string): Promise<any | null> {
    const query = `
      SELECT * FROM dbo.UKGEmployeeDetails 
      WHERE TenantId = @tenantId AND UKGEmployeeId = @ukgEmployeeId
    `;

    const parameters = { 
      tenantId, 
      ukgEmployeeId 
    };

    try {
      const result = await this.executeQuery(query, parameters);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error getting UKG employee by ID:', error);
      throw error;
    }
  }

  /**
   * Get employee names by UKG account IDs for translation purposes
   * Used to translate account IDs to actual names in clocked-in data
   */
  async getCostCenterNameById(tenantId: string, costCenterId: number): Promise<string | null> {
    const query = `
      SELECT CostCenter_LocationName, CostCenter_LocationCode
      FROM dbo.UKGEmployeeDetails 
      WHERE TenantId = @tenantId 
      AND (CostCenter_LocationId = @costCenterId)
      ORDER BY CreatedAt DESC
    `;

    try {
      const result = await this.executeQuery(query, { tenantId, costCenterId });
      if (result.length > 0) {
        const row = result[0];
        return row.CostCenter_LocationName || row.CostCenter_LocationCode || null;
      }
      return null;
    } catch (error) {
      console.error('Error fetching cost center name:', error);
      return null;
    }
  }

  async getEmployeeDetailsByAccountIds(tenantId: string, accountIds: number[]): Promise<Map<number, any>> {
    if (!accountIds || accountIds.length === 0) {
      return new Map();
    }

    // Convert account IDs to string format for the query
    const accountIdStrings = accountIds.map(id => id.toString());
    const placeholders = accountIdStrings.map((_, index) => `@accountId${index}`).join(',');
    
    const query = `
      SELECT 
        UKGEmployeeId, 
        EmployeeNumber,
        FirstName, 
        LastName, 
        FullName,
        DepartmentName,
        CostCenter_LocationName,
        CostCenter_JobTitleName,
        CostCenter_LocationCode,
        CostCenter_JobTitleCode,
        CostCenter_LocationId,
        CostCenter_JobTitleId,
        JobTitle,
        PositionTitle,
        JSON_VALUE(UkgDetailsJson, '$.primary_account_id') as primary_account_id
      FROM dbo.UKGEmployeeDetails 
      WHERE TenantId = @tenantId 
      AND JSON_VALUE(UkgDetailsJson, '$.primary_account_id') IN (${placeholders})
    `;

    const parameters: any = { tenantId };
    
    // Add each account ID as a parameter
    accountIdStrings.forEach((accountId, index) => {
      parameters[`accountId${index}`] = accountId;
    });

    try {
      const result = await this.executeQuery(query, parameters);
      const employeeMap = new Map<number, any>();
      
      result.forEach((row: any) => {
        const accountId = parseInt(row.primary_account_id);
        const employeeDetails = {
          name: row.FullName || `${row.FirstName} ${row.LastName}`.trim(),
          firstName: row.FirstName,
          lastName: row.LastName,
          employeeNumber: row.EmployeeNumber,
          department: row.DepartmentName,
          location: row.CostCenter_LocationName,        // Resolved location name from stored procedure
          locationCode: row.CostCenter_LocationCode,
          locationId: row.CostCenter_LocationId,        // Add location ID
          jobTitle: row.CostCenter_JobTitleName || row.JobTitle || row.PositionTitle,  // Use resolved job title first
          jobTitleCode: row.CostCenter_JobTitleCode,
          jobTitleId: row.CostCenter_JobTitleId         // Add job title ID
        };
        employeeMap.set(accountId, employeeDetails);
      });

      return employeeMap;
    } catch (error) {
      console.error('Error fetching employee details by account IDs:', error);
      return new Map();
    }
  }

  async getEmployeeNamesByAccountIds(tenantId: string, accountIds: number[]): Promise<Map<number, string>> {
    if (!accountIds || accountIds.length === 0) {
      return new Map();
    }

    // Convert account IDs to string format for the query
    const accountIdStrings = accountIds.map(id => id.toString());
    const placeholders = accountIdStrings.map((_, index) => `@accountId${index}`).join(',');
    
    const query = `
      SELECT UKGEmployeeId, FirstName, LastName, FullName
      FROM dbo.UKGEmployeeDetails 
      WHERE TenantId = @tenantId 
      AND UKGEmployeeId IN (${placeholders})
    `;

    const parameters: any = { tenantId };
    
    // Add each account ID as a parameter
    accountIdStrings.forEach((accountId, index) => {
      parameters[`accountId${index}`] = accountId;
    });

    try {
      const result = await this.executeQuery(query, parameters);
      const nameMap = new Map<number, string>();
      
      result.forEach((row: any) => {
        const accountId = parseInt(row.UKGEmployeeId);
        const name = row.FullName || `${row.FirstName} ${row.LastName}`.trim();
        nameMap.set(accountId, name);
      });
      
      return nameMap;
    } catch (error) {
      console.error('Error getting employee names by account IDs:', error);
      // Return empty map on error rather than throwing
      return new Map();
    }
  }

  /**
   * Unified employee lookup that handles both UKG account IDs and employee numbers/payroll IDs
   * Returns comprehensive employee information from both UKG and Par Brink sources
   * Prioritizes UKG data for clocked-in functionality but includes both sources when available
   */
  async getUnifiedEmployeeDetails(tenantId: string, identifiers: (string | number)[]): Promise<Map<string | number, any>> {
    if (!identifiers || identifiers.length === 0) {
      return new Map();
    }

    // Convert all identifiers to both string and number formats for comprehensive lookup
    const stringIds = identifiers.map(id => id.toString());
    const numberIds = identifiers.map(id => typeof id === 'number' ? id : parseInt(id.toString())).filter(id => !isNaN(id));
    
    const allIds = [...new Set([...stringIds, ...numberIds.map(n => n.toString())])];
    const placeholders = allIds.map((_, index) => `@id${index}`).join(',');
    
    // Query that looks up employees from both UKG and unified Employee tables
    // Prioritizes UKG data but includes Par Brink data when available
    const query = `
      WITH UnifiedEmployees AS (
        -- UKG Employee Details (Primary source for clocked-in data)
        SELECT 
          UKGEmployeeId as EmployeeIdentifier,
          EmployeeNumber,
          FirstName,
          LastName,
          FullName,
          DepartmentName,
          CostCenter_LocationName as LocationName,
          CostCenter_Number as CostCenterNumber,
          CostCenter_Name as CostCenterName,
          'UKG' as DataSource,
          1 as Priority -- Higher priority for UKG data
        FROM dbo.UKGEmployeeDetails 
        WHERE TenantId = @tenantId 
        AND (UKGEmployeeId IN (${placeholders}) OR EmployeeNumber IN (${placeholders}))
        
        UNION ALL
        
        -- Unified Employee table (Contains both UKG and Par Brink data)
        SELECT 
          COALESCE(EmployeeNumber, PayrollId) as EmployeeIdentifier,
          EmployeeNumber,
          FirstName,
          LastName,
          COALESCE(FullName, FirstName + ' ' + LastName) as FullName,
          Department as DepartmentName,
          Location as LocationName,
          NULL as CostCenterNumber,
          NULL as CostCenterName,
          DataSource,
          CASE WHEN DataSource = 'UKG' THEN 2 ELSE 3 END as Priority
        FROM dbo.Employees 
        WHERE TenantId = @tenantId 
        AND IsActive = 1
        AND (EmployeeNumber IN (${placeholders}) OR PayrollId IN (${placeholders}))
      ),
      RankedEmployees AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY EmployeeIdentifier ORDER BY Priority ASC) as rn
        FROM UnifiedEmployees
      )
      SELECT 
        EmployeeIdentifier,
        EmployeeNumber,
        FirstName,
        LastName,
        FullName,
        DepartmentName,
        LocationName,
        CostCenterNumber,
        CostCenterName,
        DataSource,
        CASE 
          WHEN COUNT(*) OVER (PARTITION BY EmployeeIdentifier) > 1 THEN 'BOTH'
          ELSE DataSource 
        END as EffectiveDataSource
      FROM RankedEmployees 
      WHERE rn = 1
      ORDER BY EmployeeIdentifier
    `;

    const parameters: any = { tenantId };
    
    // Add each ID as a parameter
    allIds.forEach((id, index) => {
      parameters[`id${index}`] = id;
    });

    try {
      const result = await this.executeQuery(query, parameters);
      const employeeMap = new Map<string | number, any>();
      
      result.forEach((row: any) => {
        const employeeData = {
          employeeId: row.EmployeeNumber || row.EmployeeIdentifier,
          accountId: row.EmployeeIdentifier, // Keep original account ID for reference
          name: row.FullName || `${row.FirstName || ''} ${row.LastName || ''}`.trim(),
          firstName: row.FirstName,
          lastName: row.LastName,
          department: row.DepartmentName || 'Unknown',
          location: row.LocationName || (row.CostCenterNumber ? `Location ${row.CostCenterNumber}` : 'Unknown'),
          costCenter: row.CostCenterName || (row.CostCenterNumber ? `CC: ${row.CostCenterNumber}` : row.CostCenterNumber),
          costCenterName: row.CostCenterName,
          dataSource: row.EffectiveDataSource,
          priority: row.DataSource === 'UKG' ? 'primary' : 'secondary'
        };
        
        // Map by both the original identifier and employee number for flexible lookup
        employeeMap.set(row.EmployeeIdentifier, employeeData);
        if (row.EmployeeNumber && row.EmployeeNumber !== row.EmployeeIdentifier) {
          employeeMap.set(row.EmployeeNumber, employeeData);
        }
      });
      
      return employeeMap;
    } catch (error) {
      console.error('Error fetching unified employee details:', error);
      return new Map();
    }
  }

  /**
   * Batch upsert UKG employees for efficiency
   */
  async batchUpsertUKGEmployees(employees: UKGEmployeeDetails[]): Promise<void> {
    const pool = await this.getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      for (const employee of employees) {
        const request = new sql.Request(transaction);
        
        // Set input parameters for the stored procedure
        request.input('TenantId', sql.UniqueIdentifier, employee.tenantId);
        request.input('UKGEmployeeId', sql.NVarChar(50), employee.ukgEmployeeId);
        request.input('EmployeeNumber', sql.NVarChar(50), employee.employeeNumber || null);
        request.input('FirstName', sql.NVarChar(100), employee.firstName);
        request.input('LastName', sql.NVarChar(100), employee.lastName);
        request.input('FullName', sql.NVarChar(200), employee.fullName || null);
        request.input('Email', sql.NVarChar(255), employee.email || null);
        request.input('Status', sql.NVarChar(50), employee.status || 'Active');
        request.input('HireDate', sql.Date, employee.hireDate || null);
        request.input('TerminationDate', sql.Date, employee.terminationDate || null);
        request.input('DepartmentId', sql.NVarChar(50), employee.departmentId || null);
        request.input('DepartmentName', sql.NVarChar(200), employee.departmentName || null);
        request.input('PositionId', sql.NVarChar(50), employee.positionId || null);
        request.input('PositionTitle', sql.NVarChar(200), employee.positionTitle || null);
        request.input('PayRate', sql.Decimal(10, 4), employee.payRate || null);
        request.input('CostCenter_LocationId', sql.BigInt, employee.costCenter_LocationId || null);
        request.input('CostCenter_LocationName', sql.NVarChar(200), employee.costCenter_LocationName || null);
        request.input('CostCenter_JobTitleId', sql.BigInt, employee.costCenter_JobTitleId || null);
        request.input('CostCenter_JobTitleName', sql.NVarChar(200), employee.costCenter_JobTitleName || null);
        request.input('CostCenter_JobTitleParentId', sql.BigInt, employee.costCenter_JobTitleParentId || null);
        request.input('CostCenter_JobTitleParentName', sql.NVarChar(200), employee.costCenter_JobTitleParentName || null);
        request.input('LocationId', sql.NVarChar(50), employee.locationId || null);
        request.input('LocationName', sql.NVarChar(200), employee.locationName || null);
        request.input('RawUKGData', sql.NVarChar(sql.MAX), employee.rawUKGData || null);
        request.input('CostCenterRawData', sql.NVarChar(sql.MAX), employee.costCenterRawData || null);

        await request.execute('dbo.UpsertUKGEmployeeDetails');
      }

      await transaction.commit();
      console.log(`✅ Successfully batch upserted ${employees.length} UKG employees`);
    } catch (error) {
      await transaction.rollback();
      console.error('Error in batch upsert UKG employees:', error);
      throw error;
    }
  }

  // =============================================================================
  // COST CENTER METHODS
  // =============================================================================

  /**
   * Upsert cost center using the stored procedure
   */
  async upsertCostCenter(costCenter: CostCenter): Promise<any> {
    const pool = await this.getConnectionPool();
    const request = new sql.Request(pool);

    try {
      request.input('CostCenterId', sql.BigInt, costCenter.costCenterId);
      request.input('Name', sql.NVarChar(200), costCenter.name);
      request.input('Code', sql.NVarChar(50), costCenter.code || null);
      request.input('ParentId', sql.BigInt, costCenter.parentId || null);
      request.input('Level', sql.Int, costCenter.level || 1);
      request.input('IsActive', sql.Bit, costCenter.isActive !== false);
      request.input('RawData', sql.NVarChar(sql.MAX), costCenter.rawData || null);

      const result = await request.execute('dbo.UpsertCostCenter');
      return result.recordset[0];
    } catch (error) {
      console.error('Error upserting cost center:', error);
      throw error;
    }
  }

  /**
   * Get cost center hierarchy
   */
  async getCostCenterHierarchy(): Promise<any[]> {
    const pool = await this.getConnectionPool();
    const request = new sql.Request(pool);

    try {
      const result = await request.execute('dbo.GetCostCenterHierarchy');
      return result.recordset;
    } catch (error) {
      console.error('Error getting cost center hierarchy:', error);
      throw error;
    }
  }

  /**
   * Get cost center name by ID
   */
  async getCostCenterName(costCenterId: number): Promise<string | null> {
    const query = `
      SELECT dbo.GetCostCenterName(@costCenterId) as CostCenterName
    `;

    const parameters = { costCenterId };

    try {
      const result = await this.executeQuery(query, parameters);
      return result[0]?.CostCenterName || null;
    } catch (error) {
      console.error('Error getting cost center name:', error);
      throw error;
    }
  }

  /**
   * Batch upsert cost centers for efficiency
   */
  async batchUpsertCostCenters(costCenters: CostCenter[]): Promise<void> {
    const pool = await this.getConnectionPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      for (const costCenter of costCenters) {
        const request = new sql.Request(transaction);
        
        request.input('CostCenterId', sql.BigInt, costCenter.costCenterId);
        request.input('Name', sql.NVarChar(200), costCenter.name);
        request.input('Code', sql.NVarChar(50), costCenter.code || null);
        request.input('ParentId', sql.BigInt, costCenter.parentId || null);
        request.input('Level', sql.Int, costCenter.level || 1);
        request.input('IsActive', sql.Bit, costCenter.isActive !== false);
        request.input('RawData', sql.NVarChar(sql.MAX), costCenter.rawData || null);

        await request.execute('dbo.UpsertCostCenter');
      }

      await transaction.commit();
      console.log(`✅ Successfully batch upserted ${costCenters.length} cost centers`);
    } catch (error) {
      await transaction.rollback();
      console.error('Error in batch upsert cost centers:', error);
      throw error;
    }
  }

  /**
   * Resolve cost center names by updating records with available data
   * This should be called after employee sync to populate cost center names
   */
  async resolveCostCenterNames(tenantId: string): Promise<{ updated: number; errors: string[] }> {
    console.log(`🔄 Starting cost center name resolution for tenant ${tenantId}...`);
    
    try {
      // Call the stored procedure that uses the CostCenters lookup table for real name resolution
      const pool = await this.getConnectionPool();
      const request = new sql.Request(pool);
      request.input('TenantId', sql.UniqueIdentifier, tenantId);
      
      console.log(`📞 Calling ResolveCostCenterNames stored procedure for tenant ${tenantId}...`);
      const result = await request.execute('dbo.ResolveCostCenterNames');
      
      // The stored procedure returns updated count and any error messages
      const updated = result.recordset && result.recordset.length > 0 
        ? result.recordset[0].UpdatedRecords || 0 
        : 0;
      
      console.log(`✅ Cost center name resolution completed. Updated ${updated} records for tenant ${tenantId}`);
      
      return { 
        updated, 
        errors: [] 
      };
      
    } catch (error) {
      console.error('❌ Error in cost center name resolution:', error);
      return { 
        updated: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }

  /**
   * Execute raw SQL (for deployment scripts and stored procedure creation)
   */
  async executeRawSQL(sqlContent: string): Promise<any> {
    const pool = await this.getConnectionPool();
    
    try {
      // Split the SQL content by GO statements and execute each batch
      const batches = sqlContent
        .split(/\bGO\b/gi)
        .map(batch => batch.trim())
        .filter(batch => batch.length > 0);
      
      const results = [];
      
      for (const batch of batches) {
        if (batch.trim()) {
          console.log(`🔄 Executing SQL batch: ${batch.substring(0, 100)}...`);
          const request = new sql.Request(pool);
          const result = await request.query(batch);
          results.push(result);
        }
      }
      
      return results;
    } catch (error) {
      console.error('❌ Error executing raw SQL:', error);
      throw error;
    }
  }

  /**
   * Store clocked-in employees in UKGClockedInCache table
   * Enhanced to automatically resolve real employee names from Employees table
   */
  async storeClockedInEmployees(tenantId: string, employees: any[]): Promise<void> {
    if (!employees || employees.length === 0) {
      return;
    }

    const pool = await this.getConnectionPool();
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Clear existing cache for today first
      const clearRequest = new sql.Request(pool);
      clearRequest.input('tenantId', sql.UniqueIdentifier, tenantId);
      clearRequest.input('businessDate', sql.Date, today);
      
      await clearRequest.query(`
        DELETE FROM dbo.UKGClockedInCache 
        WHERE TenantId = @tenantId AND BusinessDate = @businessDate
      `);
      
      // Get real employee names for all account IDs in this batch
      const accountIds = employees.map(emp => emp.account_id).filter(id => id);
      const employeeNamesMap = new Map();
      
      if (accountIds.length > 0) {
        const nameRequest = new sql.Request(pool);
        nameRequest.input('tenantId', sql.UniqueIdentifier, tenantId);
        
        const accountIdList = accountIds.join(',');
        const nameQuery = `
          SELECT 
            JSON_VALUE(UkgDetailsJson, '$.primary_account_id') as primary_account_id, 
            FirstName,
            LastName,
            FullName,
            Email
          FROM Employees 
          WHERE TenantId = @tenantId 
            AND UkgDetailsJson IS NOT NULL
            AND JSON_VALUE(UkgDetailsJson, '$.primary_account_id') IN (${accountIdList})
        `;
        
        const nameResult = await nameRequest.query(nameQuery);
        nameResult.recordset.forEach(row => {
          const accountId = parseInt(row.primary_account_id);
          employeeNamesMap.set(accountId, {
            firstName: row.FirstName,
            lastName: row.LastName,
            fullName: row.FullName,
            email: row.Email
          });
        });
        
        console.log(`🔍 Resolved ${employeeNamesMap.size} real employee names for cache storage`);
      }
      
      // Insert new clocked-in data with enhanced name resolution
      for (const emp of employees) {
        const insertQuery = `
          INSERT INTO dbo.UKGClockedInCache (
            TenantId, account_id, UKGEmployeeId, EmployeeNumber, FirstName, LastName, Email,
            BusinessDate, ClockInTime, LocationCostCenterId, DepartmentCostCenterId,
            LocationName, DepartmentName, TimeEntryId, HoursWorkedSoFar, 
            IsCurrentlyActive, CacheRefreshTime, CreatedAt, UpdatedAt
          ) VALUES (
            @tenantId, @accountId, @ukgEmployeeId, @employeeNumber, @firstName, @lastName, @email,
            @businessDate, @clockInTime, @locationCostCenterId, @departmentCostCenterId,
            @locationName, @departmentName, @timeEntryId, @hoursWorkedSoFar,
            @isCurrentlyActive, @cacheRefreshTime, @createdAt, @updatedAt
          )
        `;
        
        const empRequest = new sql.Request(pool);
        const clockInTime = new Date(emp.clockInTime);
        const hoursWorked = (Date.now() - clockInTime.getTime()) / (1000 * 60 * 60);
        const now = new Date();
        
        // Use resolved employee data if available, otherwise fall back to original data
        const resolvedEmployee = employeeNamesMap.get(emp.account_id);
        const firstName = resolvedEmployee?.firstName || emp.firstName;
        const lastName = resolvedEmployee?.lastName || emp.lastName;
        const email = resolvedEmployee?.email || emp.email;
        
        empRequest.input('tenantId', sql.UniqueIdentifier, tenantId);
        empRequest.input('accountId', sql.BigInt, emp.account_id);
        empRequest.input('ukgEmployeeId', sql.VarChar(50), emp.ukgEmployeeId);
        empRequest.input('employeeNumber', sql.VarChar(50), emp.employeeNumber);
        empRequest.input('firstName', sql.NVarChar(100), firstName);
        empRequest.input('lastName', sql.NVarChar(100), lastName);
        empRequest.input('email', sql.NVarChar(255), email || null);
        empRequest.input('businessDate', sql.Date, today);
        empRequest.input('clockInTime', sql.DateTime2, clockInTime);
        empRequest.input('locationCostCenterId', sql.Int, emp.locationCostCenterId || null);
        empRequest.input('departmentCostCenterId', sql.Int, emp.departmentCostCenterId || null);
        empRequest.input('locationName', sql.NVarChar(200), emp.locationName || null);
        empRequest.input('departmentName', sql.NVarChar(200), emp.departmentName || null);
        empRequest.input('timeEntryId', sql.BigInt, emp.timeEntryId || null);
        empRequest.input('hoursWorkedSoFar', sql.Decimal(5, 2), Math.round(hoursWorked * 100) / 100);
        empRequest.input('isCurrentlyActive', sql.Bit, true);
        empRequest.input('cacheRefreshTime', sql.DateTime2, now);
        empRequest.input('createdAt', sql.DateTime2, now);
        empRequest.input('updatedAt', sql.DateTime2, now);
        
        await empRequest.query(insertQuery);
      }
      
      console.log(`✅ Stored ${employees.length} clocked-in employees in cache for tenant ${tenantId}`);
      
    } catch (error) {
      console.error('❌ Error storing clocked-in employees:', error);
      throw error;
    }
  }

  /**
   * Get clocked-in employees from UKGClockedInCache table
   */
  async getClockedInEmployees(tenantId: string, businessDate?: string): Promise<any[]> {
    const pool = await this.getConnectionPool();
    
    try {
      
      const query = `
        SELECT 
          c.Id,
          c.UKGEmployeeId,
          c.EmployeeNumber,
          c.FirstName,
          c.LastName,
          c.Email,
          c.ClockInTime,
          c.LocationCostCenterId,
          c.DepartmentCostCenterId,
          c.LocationName,
          c.DepartmentName,
          c.TimeEntryId,
          c.HoursWorkedSoFar,
          c.BusinessDate,
          c.CacheRefreshTime,
          c.UpdatedAt,
          c.CreatedAt,
          e.FirstName as EmpFirstName,
          e.LastName as EmpLastName,
          e.JobTitle,
          e.CostCenterRawData,
          e.CostCenter_LocationId as EmpLocationId,
          e.CostCenter_JobTitleId as EmpDepartmentId,
          e.CostCenter_LocationName as EmpLocationName,
          e.CostCenter_JobTitleName as EmpJobTitleName
        FROM dbo.UKGClockedInCache c
        LEFT JOIN dbo.UKGEmployeeDetails e ON c.TenantId = e.TenantId 
          AND c.UKGEmployeeId = e.UKGEmployeeId
        WHERE c.TenantId = @tenantId 
          AND c.IsCurrentlyActive = 1
        ORDER BY c.ClockInTime DESC
      `;
      
      const request = new sql.Request(pool);
      request.input('tenantId', sql.UniqueIdentifier, tenantId);
      
      const result = await request.query(query);
      
      console.log(`📊 Retrieved ${result.recordset.length} clocked-in employees from cache for tenant ${tenantId}`);
      
      // Debug: Log sample employee data
      if (result.recordset.length > 0) {
        const sampleEmployee = result.recordset[0];
        console.log(`🔍 Sample employee data:`, {
          Id: sampleEmployee.Id,
          UKGEmployeeId: sampleEmployee.UKGEmployeeId,
          FirstName: sampleEmployee.FirstName,
          LocationCostCenterId: sampleEmployee.LocationCostCenterId,
          DepartmentCostCenterId: sampleEmployee.DepartmentCostCenterId,
          BusinessDate: sampleEmployee.BusinessDate
        });
        
        const employeeIds = result.recordset.map(r => r.UKGEmployeeId).filter(id => id != null);
        console.log(`🔍 Employee IDs found: ${employeeIds.length} out of ${result.recordset.length} total`);
        console.log(`🔍 Sample employee IDs: [${employeeIds.slice(0, 5).join(', ')}]`);
      }
      
      return result.recordset.map(row => {
        // Use employee details data if available, fallback to cache data
        const firstName = row.EmpFirstName || row.FirstName || `Employee`;
        const lastName = row.EmpLastName || row.LastName || row.UKGEmployeeId;
        const jobTitle = row.JobTitle || '';
        
        // Use the best available names in priority order:
        // 1. From UKGEmployeeDetails 
        // 2. From cache data
        // 3. Fallback to ID-based names
        
        let locationName = row.EmpLocationName || row.LocationName;
        let departmentName = row.EmpJobTitleName || row.DepartmentName;
        
        // If still no names, create fallback names using IDs
        if (!locationName && (row.LocationCostCenterId || row.EmpLocationId)) {
          const locationId = row.LocationCostCenterId || row.EmpLocationId;
          locationName = `Location ${locationId}`;
        }
        
        if (!departmentName && (row.DepartmentCostCenterId || row.EmpDepartmentId)) {
          const departmentId = row.DepartmentCostCenterId || row.EmpDepartmentId;
          departmentName = `Department ${departmentId}`;
        }
        
        return {
          id: row.Id,
          ukgEmployeeId: row.UKGEmployeeId,
          employeeNumber: row.EmployeeNumber,
          firstName: firstName,
          lastName: lastName,
          fullName: `${firstName} ${lastName}`,
          displayName: `${firstName} ${lastName}`,
          name: `${firstName} ${lastName}`,
          email: row.Email,
          jobTitle: jobTitle,
          clockInTime: row.ClockInTime.toISOString(),
          hoursWorked: row.HoursWorkedSoFar || 0,
          locationCostCenterId: row.LocationCostCenterId || row.EmpLocationId,
          departmentCostCenterId: row.DepartmentCostCenterId || row.EmpDepartmentId,
          locationName: locationName || `Location ${row.LocationCostCenterId || row.EmpLocationId || 'Unknown'}`,
          departmentName: departmentName || `Department ${row.DepartmentCostCenterId || row.EmpDepartmentId || 'Unknown'}`,
          timeEntryId: row.TimeEntryId,
          businessDate: row.BusinessDate,
          isActive: true,
          cacheRefreshTime: row.CacheRefreshTime,
          lastSyncDate: row.UpdatedAt || row.CreatedAt
        };
      });
      
    } catch (error) {
      console.error('❌ Error getting clocked-in employees:', error);
      throw error;
    }
  }

  /**
   * Clear clocked-in cache for a specific date
   */
  async clearClockedInCache(tenantId: string, businessDate?: string): Promise<void> {
    const pool = await this.getConnectionPool();
    
    try {
      const dateFilter = businessDate || new Date().toISOString().split('T')[0];
      
      const query = `
        DELETE FROM dbo.UKGClockedInCache 
        WHERE TenantId = @tenantId AND BusinessDate = @businessDate
      `;
      
      const request = new sql.Request(pool);
      request.input('tenantId', sql.UniqueIdentifier, tenantId);
      request.input('businessDate', sql.Date, dateFilter);
      
      await request.query(query);
      
      console.log(`🧹 Cleared clocked-in cache for tenant ${tenantId}, date ${dateFilter}`);
      
    } catch (error) {
      console.error('❌ Error clearing clocked-in cache:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive cache statistics for health monitoring
   */
  async getCacheStatistics(tenantId: string): Promise<{
    lastRefreshTime: Date | null;
    totalEmployees: number;
    totalClockedIn: number;
    totalActiveStores: number;
    avgRefreshDuration: number;
    lastRefreshDuration: number;
    successRate: number;
  }> {
    const pool = await this.getConnectionPool();
    
    try {
      const query = `
        SELECT 
          -- Cache timing
          MAX(c.CacheRefreshTime) as lastRefreshTime,
          MAX(c.UpdatedAt) as lastUpdateTime,
          
          -- Current data counts
          COUNT(DISTINCT c.UKGEmployeeId) as totalClockedIn,
          COUNT(DISTINCT c.LocationCostCenterId) as totalActiveStores,
          
          -- Employee totals (from UKGEmployeeDetails)
          (SELECT COUNT(*) FROM dbo.UKGEmployeeDetails e WHERE e.TenantId = @tenantId AND e.IsActive = 1) as totalEmployees
          
        FROM dbo.UKGClockedInCache c
        WHERE c.TenantId = @tenantId 
          AND c.BusinessDate = CONVERT(DATE, GETDATE())
          AND c.IsCurrentlyActive = 1
      `;
      
      const request = new sql.Request(pool);
      request.input('tenantId', sql.UniqueIdentifier, tenantId);
      
      const result = await request.query(query);
      
      if (result.recordset.length === 0) {
        return {
          lastRefreshTime: null,
          totalEmployees: 0,
          totalClockedIn: 0,
          totalActiveStores: 0,
          avgRefreshDuration: 0,
          lastRefreshDuration: 0,
          successRate: 0
        };
      }
      
      const row = result.recordset[0];
      
      // Note: refresh duration and success rate would need additional tracking
      // For now, return basic metrics with placeholder performance data
      return {
        lastRefreshTime: row.lastRefreshTime || row.lastUpdateTime,
        totalEmployees: row.totalEmployees || 0,
        totalClockedIn: row.totalClockedIn || 0,
        totalActiveStores: row.totalActiveStores || 0,
        avgRefreshDuration: 30, // Placeholder - would need historical tracking
        lastRefreshDuration: 25, // Placeholder - would need historical tracking
        successRate: 95 // Placeholder - would need failure tracking
      };
      
    } catch (error) {
      console.error('❌ Error getting cache statistics:', error);
      throw error;
    }
  }

  /**
   * Get multiple cost center names by IDs (batch lookup for performance)
   */
  async getCostCenterNamesByIds(tenantId: string, costCenterIds: number[]): Promise<Map<number, string>> {
    const results = new Map<number, string>();
    
    if (!costCenterIds || costCenterIds.length === 0) {
      return results;
    }
    
    const pool = await this.getConnectionPool();
    
    try {
      // Filter out null/undefined values
      const validIds = costCenterIds.filter(id => id != null && id > 0);
      
      if (validIds.length === 0) {
        return results;
      }
      
      // Build the query with proper parameter names
      const parameterizedQuery = `
        SELECT [Id], [Name]
        FROM [dbo].[CostCenters]
        WHERE [Id] IN (${validIds.map((_, index) => `@id${index}`).join(',')})
          AND [TenantId] = @tenantId 
          AND [IsActive] = 1
      `;
      
      const request = new sql.Request(pool);
      request.input('tenantId', sql.UniqueIdentifier, tenantId);
      
      // Add parameters for each ID
      validIds.forEach((id, index) => {
        request.input(`id${index}`, sql.BigInt, id);
      });
      
      const result = await request.query(parameterizedQuery);
      
      result.recordset.forEach(row => {
        results.set(row.Id, row.Name);
      });
      
      console.log(`📊 Retrieved ${result.recordset.length} cost center names for ${validIds.length} IDs`);
      
    } catch (error) {
      console.error('❌ Error getting cost center names:', error);
    }
    
    return results;
  }

  /**
   * Get account name by account ID from UKG employee data
   * This maps accountId to the employee's name/title information
   */
  async getAccountNameById(tenantId: string, accountId: number): Promise<string | null> {
    if (!accountId) return null;
    
    const pool = await this.getConnectionPool();
    
    try {
      // First, try to find in the UKGEmployeeDetails table
      // AccountId in UKG typically refers to the employee's organizational account
      const query = `
        SELECT TOP 1
          CASE 
            WHEN [FullName] IS NOT NULL AND [FullName] != '' THEN [FullName]
            WHEN [FirstName] IS NOT NULL AND [LastName] IS NOT NULL 
              THEN CONCAT([FirstName], ' ', [LastName])
            WHEN [DisplayName] IS NOT NULL AND [DisplayName] != '' THEN [DisplayName]
            WHEN [EmployeeNumber] IS NOT NULL THEN CONCAT('Employee ', [EmployeeNumber])
            ELSE CONCAT('Account ', @accountId)
          END AS AccountName,
          [JobTitle],
          [DepartmentName],
          [PositionTitle]
        FROM [dbo].[UKGEmployeeDetails]
        WHERE [TenantId] = @tenantId 
          AND [AccountId] = @accountId
          AND [IsActive] = 1
        ORDER BY [LastSyncAt] DESC
      `;
      
      const request = new sql.Request(pool);
      request.input('accountId', sql.Int, accountId);
      request.input('tenantId', sql.UniqueIdentifier, tenantId);
      
      const result = await request.query(query);
      
      if (result.recordset.length > 0) {
        const row = result.recordset[0];
        // Return name with title if available
        if (row.JobTitle) {
          return `${row.AccountName} (${row.JobTitle})`;
        } else if (row.PositionTitle) {
          return `${row.AccountName} (${row.PositionTitle})`;
        } else {
          return row.AccountName;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Error getting account name for ID ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple account names by IDs (batch lookup for performance)
   */
  async getAccountNamesByIds(tenantId: string, accountIds: number[]): Promise<Map<number, string>> {
    const results = new Map<number, string>();
    
    if (!accountIds || accountIds.length === 0) {
      return results;
    }
    
    const pool = await this.getConnectionPool();
    
    try {
      // Filter out null/undefined values
      const validIds = accountIds.filter(id => id != null && id > 0);
      
      if (validIds.length === 0) {
        return results;
      }
      
      const query = `
        SELECT 
          [AccountId],
          CASE 
            WHEN [FullName] IS NOT NULL AND [FullName] != '' THEN [FullName]
            WHEN [FirstName] IS NOT NULL AND [LastName] IS NOT NULL 
              THEN CONCAT([FirstName], ' ', [LastName])
            WHEN [DisplayName] IS NOT NULL AND [DisplayName] != '' THEN [DisplayName]
            WHEN [EmployeeNumber] IS NOT NULL THEN CONCAT('Employee ', [EmployeeNumber])
            ELSE CONCAT('Account ', [AccountId])
          END AS AccountName,
          [JobTitle],
          [PositionTitle]
        FROM [dbo].[UKGEmployeeDetails]
        WHERE [TenantId] = @tenantId 
          AND [AccountId] IN (${validIds.map((_, index) => `@id${index}`).join(',')})
          AND [IsActive] = 1
      `;
      
      const request = new sql.Request(pool);
      request.input('tenantId', sql.UniqueIdentifier, tenantId);
      
      // Add parameters for each ID
      validIds.forEach((id, index) => {
        request.input(`id${index}`, sql.Int, id);
      });
      
      const result = await request.query(query);
      
      result.recordset.forEach(row => {
        let accountName = row.AccountName;
        
        // Add title if available
        if (row.JobTitle) {
          accountName = `${accountName} (${row.JobTitle})`;
        } else if (row.PositionTitle) {
          accountName = `${accountName} (${row.PositionTitle})`;
        }
        
        results.set(row.AccountId, accountName);
      });
      
      console.log(`📊 Retrieved ${result.recordset.length} account names for ${validIds.length} IDs`);
      
    } catch (error) {
      console.error('❌ Error getting account names:', error);
    }
    
    return results;
  }

  /**
   * Resolve cost center and account names for clocked-in employees
   * This is a helper method to enhance employee data with readable names
   */
  async resolveClockedInEmployeeNames(tenantId: string, employees: any[]): Promise<any[]> {
    if (!employees || employees.length === 0) {
      return employees;
    }
    
    try {
      console.log(`🔍 Resolving names for ${employees.length} clocked-in employees`);
      
      // Extract unique account IDs for employee name lookup  
      const accountIds = [...new Set(employees
        .map(emp => emp.accountId)
        .filter(id => id != null)
      )];
      
      const locationCostCenterIds = [...new Set(employees
        .map(emp => emp.locationCostCenterId)
        .filter(id => id != null && id > 0)
      )];
      
      const departmentCostCenterIds = [...new Set(employees
        .map(emp => emp.departmentCostCenterId)
        .filter(id => id != null && id > 0)
      )];
      
      console.log(`📊 Found ${accountIds.length} unique employees, ${locationCostCenterIds.length} locations, ${departmentCostCenterIds.length} departments`);
      
      // Get employee names using account_id lookup from Employees table with JSON extraction
      let employeeNamesMap = new Map();
      if (accountIds.length > 0) {
        const request = this.pool.request();
        request.input('tenantId', sql.UniqueIdentifier, tenantId);
        
        const accountIdList = accountIds.join(',');
        const query = `
          SELECT 
            JSON_VALUE(UkgDetailsJson, '$.primary_account_id') as primary_account_id,
            FullName
          FROM Employees 
          WHERE TenantId = @tenantId 
            AND UkgDetailsJson IS NOT NULL
            AND JSON_VALUE(UkgDetailsJson, '$.primary_account_id') IN (${accountIdList})
        `;
        
        const result = await request.query(query);
        result.recordset.forEach(row => {
          employeeNamesMap.set(parseInt(row.primary_account_id), row.FullName);
        });
        
        console.log(`✅ Resolved ${employeeNamesMap.size} employee names from Employees table`);
      }
      
      // Batch lookup cost center names
      const [locationNames, departmentNames] = await Promise.all([
        this.getCostCenterNamesByIds(tenantId, locationCostCenterIds),
        this.getCostCenterNamesByIds(tenantId, departmentCostCenterIds)
      ]);
      
      // Enhance employees with resolved names
      const enhancedEmployees = employees.map(employee => ({
        ...employee,
        // Resolve account ID to employee name
        employeeName: employee.accountId ? employeeNamesMap.get(employee.accountId) || `Employee ${employee.accountId}` : null,
        // Resolve location cost center
        locationName: employee.locationCostCenterId 
          ? locationNames.get(employee.locationCostCenterId) || employee.locationName || `Location ${employee.locationCostCenterId}`
          : employee.locationName || 'Unknown Location',
        // Resolve department cost center  
        departmentName: employee.departmentCostCenterId
          ? departmentNames.get(employee.departmentCostCenterId) || employee.departmentName || `Department ${employee.departmentCostCenterId}`
          : employee.departmentName || 'Unknown Department',
        // Legacy costCenter field for compatibility
        costCenter: employee.departmentCostCenterId
          ? departmentNames.get(employee.departmentCostCenterId) || employee.departmentName || `Department ${employee.departmentCostCenterId}`
          : employee.costCenter || 'Unknown',
        // Legacy location field for compatibility
        location: employee.locationCostCenterId 
          ? locationNames.get(employee.locationCostCenterId) || employee.locationName || `Location ${employee.locationCostCenterId}`
          : employee.location || 'Unknown'
      }));
      
      console.log(`✅ Enhanced ${enhancedEmployees.length} employees with resolved names`);
      console.log(`   - Resolved ${employeeNamesMap.size} employee names`);
      console.log(`   - Resolved ${locationNames.size} location names`);  
      console.log(`   - Resolved ${departmentNames.size} department names`);
      
      return enhancedEmployees;
      
    } catch (error) {
      console.error('❌ Error resolving employee names:', error);
      return employees; // Return original data if resolution fails
    }
  }

  // ============================================================================
  // UKG TIME ENTRIES METHODS
  // ============================================================================

  /**
   * Store UKG time entries data in the database
   * UKG sends data in format: { time_entry_sets: [{ employee: { account_id }, time_entries: [...] }] }
   */
  async storeUKGTimeEntries(tenantId: string, timeEntriesData: any): Promise<{ success: boolean; processed: number; errors: string[] }> {
    const pool = await this.getConnectionPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      
      let processed = 0;
      const errors: string[] = [];
      
      // Extract time entries from UKG response structure
      let allTimeEntries: any[] = [];
      if (timeEntriesData.time_entry_sets) {
        // UKG response format: { time_entry_sets: [{ employee: {...}, time_entries: [...] }] }
        for (const set of timeEntriesData.time_entry_sets) {
          if (set.time_entries && Array.isArray(set.time_entries)) {
            // Add employee info to each time entry
            const enhancedEntries = set.time_entries.map(entry => ({
              ...entry,
              employee: {
                account_id: set.employee?.account_id,
                id: set.employee?.account_id // Map account_id to id for compatibility
              }
            }));
            allTimeEntries.push(...enhancedEntries);
          }
        }
      } else if (Array.isArray(timeEntriesData)) {
        // Direct array format (fallback)
        allTimeEntries = timeEntriesData;
      } else {
        throw new Error('Invalid UKG time entries data format');
      }
      
      console.log(`🔄 Processing ${allTimeEntries.length} time entries from UKG response`);
      
      // Log the raw UKG response structure for debugging
      console.log(`🔍 RAW UKG RESPONSE STRUCTURE:`, JSON.stringify(timeEntriesData, null, 2));
      console.log(`🔍 FIRST ENTRY STRUCTURE:`, allTimeEntries.length > 0 ? JSON.stringify(allTimeEntries[0], null, 2) : 'No entries');
      
      for (const entry of allTimeEntries) {
        try {
          // Validate required fields before processing
          if (!entry.id) {
            errors.push(`Entry missing required field 'id': ${JSON.stringify(entry)}`);
            continue;
          }
          
          if (!entry.date) {
            errors.push(`Entry ${entry.id} missing required field 'date': ${JSON.stringify(entry)}`);
            continue;
          }
          
          if (!entry.type) {
            errors.push(`Entry ${entry.id} missing required field 'type': ${JSON.stringify(entry)}`);
            continue;
          }
          
          // Validate employee data
          if (!entry.employee?.account_id) {
            errors.push(`Entry ${entry.id} missing required employee.account_id: ${JSON.stringify(entry)}`);
            continue;
          }
          
          // Check if entry already exists
          const existingQuery = `
            SELECT [Id] FROM [dbo].[UKGTimeEntries] 
            WHERE [TenantId] = @tenantId AND [UkgTimeEntryId] = @ukgTimeEntryId
          `;
          
          const existingRequest = new sql.Request(transaction);
          existingRequest.input('tenantId', sql.NVarChar, tenantId);
          existingRequest.input('ukgTimeEntryId', sql.BigInt, entry.id);
          
          const existingResult = await existingRequest.query(existingQuery);
          
          if (existingResult.recordset.length > 0) {
            // Update existing entry
            const updateQuery = `
              UPDATE [dbo].[UKGTimeEntries] SET
                [EmployeeAccountId] = @employeeAccountId,
                [EmployeeNumber] = @employeeNumber,
                [EmployeeName] = @employeeName,
                [EntryType] = @entryType,
                [EntryDate] = @entryDate,
                [StartTime] = @startTime,
                [EndTime] = @endTime,
                [TotalHours] = @totalHours,
                [GroupHash] = @groupHash,
                [ApprovalStatus] = @approvalStatus,
                [IsRaw] = @isRaw,
                [IsCalculated] = @isCalculated,
                [LocationCostCenterId] = @locationCostCenterId,
                [DepartmentCostCenterId] = @departmentCostCenterId,
                [LocationName] = @locationName,
                [DepartmentName] = @departmentName,
                [ModifiedDate] = GETUTCDATE(),
                [UkgApiResponse] = @ukgApiResponse
              WHERE [Id] = @id
            `;
            
            const updateRequest = new sql.Request(transaction);
            updateRequest.input('id', sql.BigInt, existingResult.recordset[0].Id);
            // UKG response has employee.account_id, not employee.id
            updateRequest.input('employeeAccountId', sql.BigInt, entry.employee?.account_id);
            // UKG doesn't provide employee_number in time entries, use account_id as fallback
            updateRequest.input('employeeNumber', sql.NVarChar, entry.employee?.account_id?.toString() || 'Unknown');
            // UKG doesn't provide first_name/last_name in time entries, use account_id as fallback
            updateRequest.input('employeeName', sql.NVarChar, `Employee ${entry.employee?.account_id || 'Unknown'}`);
            updateRequest.input('entryType', sql.NVarChar, entry.type);
            updateRequest.input('entryDate', sql.Date, this.parseUKGDate(entry.date));
            // Convert UKG ISO 8601 datetime strings to SQL DateTime2 format
            // Log the entry data before time extraction for debugging
            console.log(`🔍 PROCESSING ENTRY ${entry.id}:`, {
              id: entry.id,
              start_time: entry.start_time,
              end_time: entry.end_time,
              entry_keys: Object.keys(entry),
              full_entry: entry
            });
            
            const startTime = entry.start_time ? this.extractTimeFromUKGDateTime(entry.start_time) : null;
            const endTime = entry.end_time ? this.extractTimeFromUKGDateTime(entry.end_time) : null;
            
            updateRequest.input('startTime', sql.DateTime2, startTime);
            updateRequest.input('endTime', sql.DateTime2, endTime);
            // Convert UKG total from milliseconds to hours (decimal)
            const totalHours = entry.total ? this.convertMillisecondsToHours(entry.total) : null;
            updateRequest.input('totalHours', sql.Decimal(5,2), totalHours);
            // UKG doesn't provide group_hash, use null
            updateRequest.input('groupHash', sql.BigInt, null);
            updateRequest.input('approvalStatus', sql.NVarChar, entry.approval_status);
            // UKG uses is_raw and is_calc (boolean)
            updateRequest.input('isRaw', sql.Bit, entry.is_raw === true ? 1 : 0);
            updateRequest.input('isCalculated', sql.Bit, entry.is_calc === true ? 1 : 0);
            // UKG cost_centers format: [{"index": 0, "value": {"id": 8629223613}}, {"index": 1, "value": {"id": 8629105219}}]
            // index: 0 = Location, index: 1 = Department/Job
            const locationCostCenter = entry.cost_centers?.find(cc => cc.index === 0);
            const departmentCostCenter = entry.cost_centers?.find(cc => cc.index === 1);
            
            const locationCostCenterId = locationCostCenter?.value?.id;
            const departmentCostCenterId = departmentCostCenter?.value?.id;
            
            updateRequest.input('locationCostCenterId', sql.BigInt, locationCostCenterId);
            updateRequest.input('departmentCostCenterId', sql.BigInt, departmentCostCenterId);
            updateRequest.input('locationName', sql.NVarChar, locationCostCenterId ? `Cost Center ${locationCostCenterId}` : null);
            updateRequest.input('departmentName', sql.NVarChar, departmentCostCenterId ? `Cost Center ${departmentCostCenterId}` : null);
            updateRequest.input('ukgApiResponse', sql.NVarChar, JSON.stringify(entry));
            
            await updateRequest.query(updateQuery);
          } else {
            // Insert new entry
            const insertQuery = `
              INSERT INTO [dbo].[UKGTimeEntries] (
                [TenantId], [UkgTimeEntryId], [EmployeeAccountId], [EmployeeNumber], [EmployeeName],
                [EntryType], [EntryDate], [StartTime], [EndTime], [TotalHours], [GroupHash],
                [ApprovalStatus], [IsRaw], [IsCalculated], [LocationCostCenterId], [DepartmentCostCenterId],
                [LocationName], [DepartmentName], [UkgApiResponse]
              ) VALUES (
                @tenantId, @ukgTimeEntryId, @employeeAccountId, @employeeNumber, @employeeName,
                @entryType, @entryDate, @startTime, @endTime, @totalHours, @groupHash,
                @approvalStatus, @isRaw, @isCalculated, @locationCostCenterId, @departmentCostCenterId,
                @locationName, @departmentName, @ukgApiResponse
              )
            `;
            
            const insertRequest = new sql.Request(transaction);
            insertRequest.input('tenantId', sql.NVarChar, tenantId);
            insertRequest.input('ukgTimeEntryId', sql.BigInt, entry.id);
            // UKG response has employee.account_id, not employee.id
            insertRequest.input('employeeAccountId', sql.BigInt, entry.employee?.account_id);
            // UKG doesn't provide employee_number in time entries, use account_id as fallback
            insertRequest.input('employeeNumber', sql.NVarChar, entry.employee?.account_id?.toString() || 'Unknown');
            // UKG doesn't provide first_name/last_name in time entries, use account_id as fallback
            insertRequest.input('employeeName', sql.NVarChar, `Employee ${entry.employee?.account_id || 'Unknown'}`);
            insertRequest.input('entryType', sql.NVarChar, entry.type);
            insertRequest.input('entryDate', sql.Date, this.parseUKGDate(entry.date));
            // Convert UKG ISO 8601 datetime strings to SQL DateTime2 format
            // UKG format: "2025-08-10T23:49:48.000-06:00" -> parse to Date object
            // Log the entry data before time extraction for debugging
            console.log(`🔍 PROCESSING ENTRY ${entry.id}:`, {
              id: entry.id,
              start_time: entry.start_time,
              end_time: entry.end_time,
              entry_keys: Object.keys(entry),
              full_entry: entry
            });
            
            const startTime = entry.start_time ? this.extractTimeFromUKGDateTime(entry.start_time) : null;
            const endTime = entry.end_time ? this.extractTimeFromUKGDateTime(entry.end_time) : null;
            
            insertRequest.input('startTime', sql.DateTime2, startTime);
            insertRequest.input('endTime', sql.DateTime2, endTime);
            // Convert UKG total from milliseconds to hours (decimal)
            // UKG total: 15912000 ms = 4.42 hours
            const totalHours = entry.total ? this.convertMillisecondsToHours(entry.total) : null;
            insertRequest.input('totalHours', sql.Decimal(5,2), totalHours);
            // UKG doesn't provide group_hash, use null
            insertRequest.input('groupHash', sql.BigInt, null);
            insertRequest.input('approvalStatus', sql.NVarChar, entry.approval_status);
            // UKG uses is_raw and is_calc (boolean)
            insertRequest.input('isRaw', sql.Bit, entry.is_raw === true ? 1 : 0);
            insertRequest.input('isCalculated', sql.Bit, entry.is_calc === true ? 1 : 0);
            // UKG cost_centers format: [{"index": 0, "value": {"id": 8629223613}}, {"index": 1, "value": {"id": 8629105219}}]
            // index: 0 = Location, index: 1 = Department/Job
            const locationCostCenter = entry.cost_centers?.find(cc => cc.index === 0);
            const departmentCostCenter = entry.cost_centers?.find(cc => cc.index === 1);
            
            const locationCostCenterId = locationCostCenter?.value?.id;
            const departmentCostCenterId = departmentCostCenter?.value?.id;
            
            insertRequest.input('locationCostCenterId', sql.BigInt, locationCostCenterId);
            insertRequest.input('departmentCostCenterId', sql.BigInt, departmentCostCenterId);
            insertRequest.input('locationName', sql.NVarChar, locationCostCenterId ? `Cost Center ${locationCostCenterId}` : null);
            insertRequest.input('departmentName', sql.NVarChar, departmentCostCenterId ? `Cost Center ${departmentCostCenterId}` : null);
            insertRequest.input('ukgApiResponse', sql.NVarChar, JSON.stringify(entry));
            
            await insertRequest.query(insertQuery);
          }
          
          processed++;
          if (processed % 100 === 0) {
            console.log(`✅ Processed ${processed}/${allTimeEntries.length} time entries...`);
          }
        } catch (entryError) {
          const errorMessage = `Failed to process entry ${entry.id}: ${entryError.message}`;
          console.error(`❌ ${errorMessage}`, {
            entry: entry,
            error: entryError
          });
          errors.push(errorMessage);
        }
      }
      
      await transaction.commit();
      
      console.log(`🎉 Successfully processed ${processed} time entries with ${errors.length} errors`);
      if (errors.length > 0) {
        console.warn(`⚠️ Errors encountered:`, errors);
      }
      
      return {
        success: true,
        processed,
        errors
      };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get UKG time entries for a tenant with optional filters
   */
  async getUKGTimeEntries(
    tenantId: string, 
    startDate?: Date, 
    endDate?: Date, 
    employeeId?: number,
    approvalStatus?: string
  ): Promise<any[]> {
    const pool = await this.getConnectionPool();
    
    let query = `
      SELECT * FROM [dbo].[UKGTimeEntries] 
      WHERE [TenantId] = @tenantId
    `;
    
    const parameters: any = { tenantId };
    
    if (startDate) {
      query += ' AND [EntryDate] >= @startDate';
      parameters.startDate = startDate;
    }
    
    if (endDate) {
      query += ' AND [EntryDate] <= @endDate';
      parameters.endDate = endDate;
    }
    
    if (employeeId) {
      query += ' AND [EmployeeAccountId] = @employeeId';
      parameters.employeeId = employeeId;
    }
    
    if (approvalStatus) {
      query += ' AND [ApprovalStatus] = @approvalStatus';
      parameters.approvalStatus = approvalStatus;
    }
    
    query += ' ORDER BY [EntryDate] DESC, [EmployeeName]';
    
    const request = new sql.Request(pool);
    Object.keys(parameters).forEach(key => {
      request.input(key, parameters[key]);
    });
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Get time entries with Brink POS integration data
   */
  async getTimeEntriesWithBrinkData(
    tenantId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<any[]> {
    const pool = await this.getConnectionPool();
    
    let query = `
      SELECT 
        t.*,
        COALESCE(t.[SalesAmount], 0) AS [TotalSales],
        COALESCE(t.[SalesAmount], 0) AS [TotalTips],
        COALESCE(t.[SalesCount], 0) AS [TransactionCount],
        CASE 
          WHEN t.[TotalHours] > 0 AND t.[SalesAmount] > 0 
          THEN t.[SalesAmount] / t.[TotalHours] 
          ELSE NULL 
        END AS [SalesPerHour],
        CASE 
          WHEN t.[TotalHours] > 0 AND t.[TipAmount] > 0 
          THEN t.[TipAmount] / t.[TotalHours] 
          ELSE NULL 
        END AS [TipsPerHour],
        CASE 
          WHEN t.[SalesAmount] > 0 
          THEN (t.[TipAmount] / t.[SalesAmount]) * 100 
          ELSE NULL 
        END AS [TipPercentage]
      FROM [dbo].[UKGTimeEntries] t
      WHERE t.[TenantId] = @tenantId
    `;
    
    const parameters: any = { tenantId };
    
    if (startDate) {
      query += ' AND t.[EntryDate] >= @startDate';
      parameters.startDate = startDate;
    }
    
    if (endDate) {
      query += ' AND t.[EntryDate] <= @endDate';
      parameters.endDate = endDate;
    }
    
    query += ' ORDER BY t.[EntryDate] DESC, t.[EmployeeName]';
    
    const request = new sql.Request(pool);
    Object.keys(parameters).forEach(key => {
      request.input(key, parameters[key]);
    });
    
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Extract time portion from UKG ISO 8601 datetime string and convert to Date object
   * Converts "2025-08-10T23:49:48.000-06:00" to Date object
   * Returns Date object for SQL DateTime2 column (matching existing codebase pattern)
   */
  private extractTimeFromUKGDateTime(ukgDateTime: string): Date | null {
    try {
      if (!ukgDateTime) return null;
      
      // Parse the ISO 8601 datetime string to a Date object
      const date = new Date(ukgDateTime);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn(`⚠️ Invalid UKG datetime format: ${ukgDateTime}`);
        return null;
      }
      
      // Return the Date object (matching the pattern used for clockInTime)
      return date;
      
    } catch (error) {
      console.error(`❌ Error parsing UKG datetime: ${ukgDateTime}`, error);
      return null;
    }
  }

  /**
   * Convert milliseconds to hours (decimal)
   * Converts 15912000 ms to 4.42 hours
   * Handles edge cases and validation
   */
  private convertMillisecondsToHours(milliseconds: number): number {
    try {
      if (!milliseconds || isNaN(milliseconds)) {
        console.warn(`⚠️ Invalid milliseconds value: ${milliseconds}`);
        return 0;
      }
      
      // Validate reasonable range (0 to 24 hours in milliseconds)
      const maxMilliseconds = 24 * 60 * 60 * 1000; // 24 hours
      if (milliseconds < 0 || milliseconds > maxMilliseconds) {
        console.warn(`⚠️ Milliseconds out of reasonable range (0-24 hours): ${milliseconds} ms`);
        // Clamp to reasonable range
        milliseconds = Math.max(0, Math.min(milliseconds, maxMilliseconds));
      }
      
      // Convert milliseconds to hours (1 hour = 3,600,000 ms)
      const hours = milliseconds / (1000 * 60 * 60);
      
      // Round to 2 decimal places
      const roundedHours = Math.round(hours * 100) / 100;
      
      console.log(`🕐 Converted ${milliseconds} ms to ${roundedHours} hours`);
      return roundedHours;
    } catch (error) {
      console.error(`❌ Error converting milliseconds to hours: ${milliseconds}`, error);
      return 0;
    }
  }

  /**
   * Parse UKG date string to Date object
   * Handles both date-only and datetime formats
   */
  private parseUKGDate(ukgDate: string): Date {
    try {
      if (!ukgDate) {
        throw new Error('UKG date is required');
      }
      
      // UKG date format: "2025-08-10" or "2025-08-10T23:49:48.000-06:00"
      // Extract the date part before 'T' if it exists
      const datePart = ukgDate.split('T')[0];
      
      // Validate date format (YYYY-MM-DD)
      const dateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!dateMatch) {
        throw new Error(`Invalid UKG date format: ${ukgDate}`);
      }
      
      // Create Date object (UTC to avoid timezone issues)
      const year = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]) - 1; // Month is 0-indexed
      const day = parseInt(dateMatch[3]);
      
      const date = new Date(Date.UTC(year, month, day));
      
      // Validate the resulting date
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date values: year=${year}, month=${month}, day=${day}`);
      }
      
      return date;
    } catch (error) {
      console.error(`❌ Error parsing UKG date: ${ukgDate}`, error);
      // Return current date as fallback
      return new Date();
    }
  }
}
