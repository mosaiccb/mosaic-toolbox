import { InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from './TenantDatabaseService';

// UKG API Response Interfaces
interface UKGTimeEntryResponse {
    time_entry_sets: Array<{
        employee: {
            account_id: number;
        };
        start_date: string;
        end_date: string;
        time_entries: Array<{
            id: number;
            date: string;
            start_time: string;
            end_time: string;
            total: number;
            type: string;
            cost_centers: Array<{
                index: number;
                value: {
                    id: number;
                };
            }>;
            approval_status: string;
            is_raw: boolean;
            is_calc: boolean;
        }>;
    }>;
}

interface UKGAuthResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
}

interface EndpointConfig {
    id: string;
    endpointId: string;
    name: string;
    path: string;
    method: string;
    version: string;
    scanParam: boolean;
    urlParam1?: string;
    urlParam2?: string;
    urlParam3?: string;
    baseUrl: string;
    companyId: string;
    exampleUrl: string;
    headersJson?: string;
}

interface TenantConfig {
    baseUrl: string;
    companyId: string;
    clientId: string;
    apiVersion: string;
    authScope: string;
    defaultDateRangeDays: number;
    batchSize: number;
}

/**
 * Dynamic UKG Service
 * Reads endpoint configurations from database tables and builds API calls dynamically
 */
export class DynamicUKGService {
    private context: InvocationContext;
    private dbService: TenantDatabaseService;
    private tenantId: string;

    constructor(context: InvocationContext, tenantId: string) {
        this.context = context;
        this.dbService = new TenantDatabaseService();
        this.tenantId = tenantId;
    }

    /**
     * Get UKG endpoint configuration from database (endpoint structure only)
     */
    private async getEndpointConfig(endpointId: string): Promise<EndpointConfig | null> {
        try {
            this.context.log(`🔍 getEndpointConfig called with endpointId: '${endpointId}'`);
            
            // First try: Lookup by EndpointId
            let query = `
                SELECT 
                    te.[Id],
                    te.[EndpointId],
                    te.[Name],
                    te.[Path],
                    te.[Method],
                    te.[Version],
                    te.[scan_param] AS scanParam,
                    te.[url_param_1] AS urlParam1,
                    te.[url_param_2] AS urlParam2,
                    te.[url_param_3] AS urlParam3,
                    te.[HeadersJson] AS headersJson
                FROM [dbo].[UKGTenantEndpoints] te
                WHERE te.[EndpointId] = '${endpointId}'
                    AND te.[IsActive] = 1
            `;

            this.context.log(`📝 SQL Query: ${query}`);
            
            let result = await this.dbService.executeQueryWithParams(query);
            
            this.context.log(`📊 SQL Result: ${JSON.stringify(result, null, 2)}`);
            this.context.log(`📊 Result type: ${typeof result}, Length: ${result ? result.length : 'null'}`);

            // If not found by EndpointId, try fallback lookup by known IDs
            if (!result || result.length === 0) {
                this.context.log(`⚠️ EndpointId '${endpointId}' not found, trying fallback lookup by ID...`);
                
                // Fallback: Use known endpoint IDs for common endpoints
                const fallbackIds: { [key: string]: string } = {
                    'timeentrieslist': 'D4841894-6248-420B-BAC5-E512722D58C8',  // Time entries
                    'ukgemployeeslist': 'ukg-employees-list-id-here',             // Employees (update with actual ID)
                    'ukgauthtoken': 'ukg-auth-token-id-here'                     // Auth token (update with actual ID)
                };

                const fallbackId = fallbackIds[endpointId];
                if (fallbackId) {
                    this.context.log(`🔄 Fallback: Looking up endpoint by ID: ${fallbackId}`);
                    
                    query = `
                        SELECT 
                            te.[Id],
                            te.[EndpointId],
                            te.[Name],
                            te.[Path],
                            te.[Method],
                            te.[Version],
                            te.[scan_param] AS scanParam,
                            te.[url_param_1] AS urlParam1,
                            te.[url_param_2] AS urlParam2,
                            te.[url_param_3] AS urlParam3,
                            te.[HeadersJson] AS headersJson
                        FROM [dbo].[UKGTenantEndpoints] te
                        WHERE te.[Id] = '${fallbackId}'
                            AND te.[IsActive] = 1
                    `;
                    
                    this.context.log(`📝 Fallback SQL Query: ${query}`);
                    
                    result = await this.dbService.executeQueryWithParams(query);
                    
                    this.context.log(`📊 Fallback SQL Result: ${JSON.stringify(result, null, 2)}`);
                    
                    if (result && result.length > 0) {
                        this.context.log(`✅ Fallback lookup successful for endpoint: ${endpointId}`);
                    } else {
                        this.context.log(`❌ Fallback lookup also failed for endpoint: ${endpointId}`);
                    }
                } else {
                    this.context.log(`❌ No fallback ID configured for endpoint: ${endpointId}`);
                }
            }

            if (result && result.length > 0) {
                const config = result[0];
                this.context.log(`✅ Endpoint config loaded: ${config.Name} (${config.EndpointId})`);
                this.context.log(`   Raw config object: ${JSON.stringify(config, null, 2)}`);
                this.context.log(`   Path: ${config.Path}`);
                this.context.log(`   Method: ${config.Method}`);
                this.context.log(`   Parameters: ${config.urlParam1 || 'none'}, ${config.urlParam2 || 'none'}, ${config.urlParam3 || 'none'}`);
                
                // Get tenant config separately to build example URL
                const tenantConfig = await this.getTenantConfig();
                if (tenantConfig) {
                    this.context.log(`🔍 About to call buildExampleUrl with:`);
                    this.context.log(`   Config object: ${JSON.stringify(config, null, 2)}`);
                    this.context.log(`   TenantConfig object: ${JSON.stringify(tenantConfig, null, 2)}`);
                    
                    // Create the processed config object first
                    const processedConfig = {
                        id: config.Id,
                        endpointId: config.EndpointId,
                        name: config.Name,
                        path: config.Path, // Database returns 'Path' (capital P) - map to lowercase 'path'
                        method: config.Method, // Database returns 'Method' (capital M) - map to lowercase 'method'
                        version: config.Version, // Database returns 'Version' (capital V) - map to lowercase 'version'
                        scanParam: config.scanParam,
                        urlParam1: config.urlParam1,
                        urlParam2: config.urlParam2,
                        urlParam3: config.urlParam3
                    };
                    
                    const exampleUrl = this.buildExampleUrl(processedConfig, tenantConfig);
                                    return {
                    id: config.Id,
                    endpointId: config.EndpointId,
                    name: config.Name,
                    path: config.Path, // Database returns 'Path' (capital P) - map to lowercase 'path'
                    method: config.Method, // Database returns 'Method' (capital M) - map to lowercase 'method'
                    version: config.Version, // Database returns 'Version' (capital V) - map to lowercase 'version'
                    scanParam: config.scanParam,
                    urlParam1: config.urlParam1,
                    urlParam2: config.urlParam2,
                    urlParam3: config.urlParam3,
                    baseUrl: tenantConfig.baseUrl,
                    companyId: tenantConfig.companyId,
                    exampleUrl,
                    headersJson: config.headersJson
                };
                }
            } else {
                this.context.log(`❌ No endpoint configuration found for: ${endpointId}`);
            }

            return null;
        } catch (error) {
            this.context.log(`❌ Error getting endpoint config: ${error}`);
            this.context.log(`❌ Error stack: ${error.stack}`);
            return null;
        }
    }

    /**
     * Get tenant configuration from database
     */
    private async getTenantConfig(): Promise<TenantConfig | null> {
        try {
            // Get tenant info from Tenants table (includes ClientId)
            // Note: If tenantId is a string like "chuck", we need to look up by TenantName, not Id
            let tenantQuery = ``;
            let tenantResult;
            
            // Check if tenantId looks like a GUID (UUID) or a friendly name
            const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.tenantId);
            
            if (isGuid) {
                // Lookup by Id (GUID)
                tenantQuery = `
                    SELECT [Id], [TenantName], [CompanyId], [BaseUrl], [ClientId], [IsActive]
                    FROM [dbo].[UKGTenants]
                    WHERE [Id] = @tenantId AND [IsActive] = 1
                `;
                tenantResult = await this.dbService.executeQueryWithParams(tenantQuery, [
                    { name: 'tenantId', type: 'UniqueIdentifier', value: this.tenantId }
                ]);
            } else {
                // Lookup by TenantName (friendly name like "chuck")
                tenantQuery = `
                    SELECT [Id], [TenantName], [CompanyId], [BaseUrl], [ClientId], [IsActive]
                    FROM [dbo].[UKGTenants]
                    WHERE [TenantName] = @tenantId AND [IsActive] = 1
                `;
                tenantResult = await this.dbService.executeQueryWithParams(tenantQuery, [
                    { name: 'tenantId', type: 'NVarChar', value: this.tenantId }
                ]);
            }
            
            if (!tenantResult || tenantResult.length === 0) {
                this.context.log(`❌ Tenant not found: ${this.tenantId}`);
                return null;
            }

            const tenant = tenantResult[0];
            this.context.log(`✅ Tenant found: ${tenant.TenantName} (${tenant.CompanyId})`);

            // Get additional UKG config from UKGTenantConfigurations table
            // Use the actual tenant Id (GUID) from the tenant record, not the input tenantId
            const configQuery = `
                SELECT [ConfigKey], [ConfigValue], [ConfigType]
                FROM [dbo].[UKGTenantConfigurations]
                WHERE [TenantId] = @tenantGuid AND [ConfigKey] LIKE 'ukg.%'
            `;

            const configResult = await this.dbService.executeQueryWithParams(configQuery, [
                { name: 'tenantGuid', type: 'UniqueIdentifier', value: tenant.Id }
            ]);

            if (configResult && configResult.length > 0) {
                const config: any = {};
                configResult.forEach(row => {
                    const key = row.ConfigKey.replace('ukg.', '');
                    config[key] = row.ConfigValue;
                });

                const tenantConfig = {
                    baseUrl: tenant.BaseUrl || 'https://secure2.saashr.com',
                    companyId: tenant.CompanyId || '',
                    clientId: tenant.ClientId || '',
                    apiVersion: config.api_version || 'v2',
                    authScope: config.auth_scope || 'employee_management',
                    defaultDateRangeDays: parseInt(config.default_date_range_days) || 7,
                    batchSize: parseInt(config.batch_size) || 100
                };
                
                this.context.log(`✅ Tenant config loaded for tenant: ${this.tenantId}`);
                this.context.log(`   Base URL: ${tenantConfig.baseUrl}`);
                this.context.log(`   Company ID: ${tenantConfig.companyId}`);
                this.context.log(`   Client ID: ${tenantConfig.clientId}`);
                this.context.log(`   API Version: ${tenantConfig.apiVersion}`);
                this.context.log(`   Auth Scope: ${tenantConfig.authScope}`);
                
                return tenantConfig;
            }

            // Fallback to basic tenant info if no UKG config
            const tenantConfig = {
                baseUrl: tenant.BaseUrl || 'https://secure2.saashr.com',
                companyId: tenant.CompanyId || '',
                clientId: tenant.ClientId || '',
                apiVersion: 'v2',
                authScope: 'employee_management',
                defaultDateRangeDays: 7,
                batchSize: 100
            };
            
            this.context.log(`✅ Basic tenant config loaded for tenant: ${this.tenantId}`);
            this.context.log(`   Base URL: ${tenantConfig.baseUrl}`);
            this.context.log(`   Company ID: ${tenantConfig.companyId}`);
            this.context.log(`   Client ID: ${tenantConfig.clientId}`);
            
            return tenantConfig;
        } catch (error) {
            this.context.log(`❌ Error getting tenant config: ${error}`);
            return null;
        }
    }

    /**
     * Build example URL with parameters
     */
    private buildExampleUrl(config: any, tenantConfig: TenantConfig): string {
        // Add defensive programming to prevent undefined errors
        if (!config || !config.path) {
            this.context.log(`❌ buildExampleUrl: config or config.path is undefined`);
            this.context.log(`   Config object: ${JSON.stringify(config, null, 2)}`);
            throw new Error('Endpoint configuration is missing path property');
        }
        
        if (!tenantConfig || !tenantConfig.baseUrl || !tenantConfig.companyId) {
            this.context.log(`❌ buildExampleUrl: tenantConfig is missing required properties`);
            this.context.log(`   TenantConfig object: ${JSON.stringify(tenantConfig, null, 2)}`);
            throw new Error('Tenant configuration is missing required properties');
        }
        
        const baseUrl = tenantConfig.baseUrl;
        const path = config.path.replace('{cid}', tenantConfig.companyId);
        const params = [];
        
        if (config.urlParam1) params.push(`${config.urlParam1}={start_date}`);
        if (config.urlParam2) params.push(`${config.urlParam2}={end_date}`);
        if (config.urlParam3) params.push(`${config.urlParam3}=true`);
        
        const queryString = params.length > 0 ? '?' + params.join('&') : '';
        const exampleUrl = baseUrl + path + queryString;
        
        // Log example URL construction
        this.context.log(`📝 Example URL Construction:`);
        this.context.log(`   Base URL: ${baseUrl}`);
        this.context.log(`   Path: ${path}`);
        this.context.log(`   Parameters: ${params.join(', ')}`);
        this.context.log(`   Example URL: ${exampleUrl}`);
        
        return exampleUrl;
    }

    /**
     * Build actual API URL with parameters
     */
    private buildApiUrl(config: EndpointConfig, tenantConfig: TenantConfig, params: Record<string, string>): string {
        const baseUrl = tenantConfig.baseUrl;
        const path = config.path.replace('{cid}', tenantConfig.companyId);
        const queryParams = [];
        
        // Log URL construction steps
        this.context.log(`🔧 URL Construction Steps:`);
        this.context.log(`   Original Path: ${config.path}`);
        this.context.log(`   Company ID Placeholder: {cid}`);
        this.context.log(`   Company ID Value: ${tenantConfig.companyId}`);
        this.context.log(`   Resolved Path: ${path}`);
        
        // Build query parameters
        if (config.urlParam1 && params.start_date) {
            queryParams.push(`${config.urlParam1}=${params.start_date}`);
            this.context.log(`   Added Param: ${config.urlParam1}=${params.start_date}`);
        }
        if (config.urlParam2 && params.end_date) {
            queryParams.push(`${config.urlParam2}=${params.end_date}`);
            this.context.log(`   Added Param: ${config.urlParam2}=${params.end_date}`);
        }
        if (config.urlParam3 && params.is_light) {
            queryParams.push(`${config.urlParam3}=${params.is_light}`);
            this.context.log(`   Added Param: ${config.urlParam3}=${params.is_light}`);
        }
        
        const queryString = queryParams.length > 0 ? '?' + queryParams.join('&') : '';
        const finalUrl = baseUrl + path + queryString;
        
        this.context.log(`   Query String: ${queryString}`);
        this.context.log(`   Final URL: ${finalUrl}`);
        
        return finalUrl;
    }

    /**
     * Make UKG API request using dynamic configuration
     */
    async makeUKGRequest(endpointId: string, params: Record<string, string> = {}): Promise<any> {
        try {
            // Get endpoint configuration
            const endpointConfig = await this.getEndpointConfig(endpointId);
            if (!endpointConfig) {
                throw new Error(`Endpoint configuration not found for: ${endpointId}`);
            }

            // Get tenant configuration for headers/auth
            const tenantConfig = await this.getTenantConfig();
            if (!tenantConfig) {
                throw new Error('Tenant configuration not found');
            }

            // Build API URL
            const apiUrl = this.buildApiUrl(endpointConfig, tenantConfig, params);
            
            // Enhanced logging for dynamic URL construction
            this.context.log(`🔗 Dynamic API URL Construction:`);
            this.context.log(`   Base URL: ${tenantConfig.baseUrl}`);
            this.context.log(`   Company ID: ${tenantConfig.companyId}`);
            this.context.log(`   Endpoint Path: ${endpointConfig.path}`);
            this.context.log(`   Parameters: ${JSON.stringify(params)}`);
            this.context.log(`   Final URL: ${apiUrl}`);
            this.context.log(`   Method: ${endpointConfig.method}`);
            this.context.log(`   Endpoint: ${endpointConfig.name} (${endpointConfig.endpointId})`);
            if (!tenantConfig) {
                throw new Error('Tenant configuration not found');
            }

            // Prepare request options with custom headers from database
            let customHeaders: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            // Apply custom headers from endpoint configuration
            if (endpointConfig.headersJson) {
                try {
                    const parsedHeaders = JSON.parse(endpointConfig.headersJson);
                    customHeaders = { ...customHeaders, ...parsedHeaders };
                    this.context.log(`📋 Applied custom headers from database: ${JSON.stringify(parsedHeaders)}`);
                } catch (e) {
                    this.context.log(`⚠️ Failed to parse custom headers: ${endpointConfig.headersJson}`);
                }
            }

            const requestOptions: RequestInit = {
                method: endpointConfig.method,
                headers: customHeaders
            };

                         // Add authentication if required
             if (endpointConfig.endpointId === 'oauth-token') {
                 // Handle authentication request
                 try {
                     // Get client secret from Key Vault via database service
                     const clientSecret = await this.dbService.getClientSecret(this.tenantId);
                     if (!clientSecret) {
                         throw new Error('Client secret not found in Key Vault');
                     }
                     
                     const formData = [
                         'grant_type=client_credentials',
                         `client_id=${tenantConfig.clientId || ''}`,
                         `client_secret=${clientSecret}`
                     ].join('&');
                     
                     requestOptions.body = formData;
                     requestOptions.headers = {
                         'Content-Type': 'application/x-www-form-urlencoded'
                     };
                     
                     this.context.log(`🔐 OAuth authentication configured:`);
                     this.context.log(`   Client ID: ${tenantConfig.clientId}`);
                     this.context.log(`   Client Secret: [REDACTED]`);
                     this.context.log(`   Grant Type: client_credentials`);
                 } catch (error) {
                     this.context.log(`❌ Failed to get client secret: ${error}`);
                     throw new Error(`Authentication setup failed: ${error}`);
                 }
             } else {
                // Add authorization header for authenticated endpoints
                const accessToken = await this.getAccessToken();
                if (accessToken) {
                    requestOptions.headers = {
                        ...requestOptions.headers,
                        'Authorization': `Bearer ${accessToken}`
                    };
                }
            }

            // Make the request
            this.context.log(`🚀 Making ${endpointConfig.method} request to UKG API...`);
            this.context.log(`📋 Request Summary:`);
            this.context.log(`   Endpoint: ${endpointConfig.name} (${endpointConfig.endpointId})`);
            this.context.log(`   Method: ${endpointConfig.method}`);
            this.context.log(`   URL: ${apiUrl}`);
            this.context.log(`   Headers: ${JSON.stringify(requestOptions.headers)}`);
            if (requestOptions.body) {
                this.context.log(`   Body: ${requestOptions.body}`);
            }
            
            const response = await fetch(apiUrl, requestOptions);

            if (!response.ok) {
                throw new Error(`UKG API request failed: ${response.status} ${response.statusText}`);
            }

            // Check content type to determine how to parse response
            const contentType = response.headers.get('content-type') || '';
            this.context.log(`📥 Response content-type: ${contentType}`);

            let data: any;
            if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
                // Handle CSV/text responses
                data = await response.text();
                this.context.log(`✅ UKG API request successful (CSV/text response)`);
                this.context.log(`📥 Response received:`);
                this.context.log(`   Status: ${response.status} ${response.statusText}`);
                this.context.log(`   Response size: ${data.length} characters`);
                this.context.log(`   First 200 chars: ${data.substring(0, 200)}...`);
            } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
                // Handle XML responses
                data = await response.text();
                this.context.log(`✅ UKG API request successful (XML response)`);
                this.context.log(`📥 Response received:`);
                this.context.log(`   Status: ${response.status} ${response.statusText}`);
                this.context.log(`   Response size: ${data.length} characters`);
                this.context.log(`   First 200 chars: ${data.substring(0, 200)}...`);
            } else {
                // Handle JSON responses
                data = await response.json();
                this.context.log(`✅ UKG API request successful (JSON response)`);
                this.context.log(`📥 Response received:`);
                this.context.log(`   Status: ${response.status} ${response.statusText}`);
                this.context.log(`   Response size: ${JSON.stringify(data).length} characters`);
                this.context.log(`   Response keys: ${Object.keys(data).join(', ')}`);
            }
            
            return data;

        } catch (error) {
            this.context.log(`❌ UKG API request failed: ${error}`);
            throw error;
        }
    }

    /**
     * Get UKG time entries using dynamic configuration
     */
    async getTimeEntries(startDate: string, endDate: string): Promise<UKGTimeEntryResponse> {
        try {
            // Use the specific EndpointId for time entries (matching current database)
            const endpointId = 'timeentrieslist';
            this.context.log(`🔍 Using time entries endpoint: ${endpointId}`);
            
            const params = {
                start_date: startDate,
                end_date: endDate,
                is_light: 'true'
            };

            return await this.makeUKGRequest(endpointId, params);
        } catch (error) {
            this.context.log(`❌ Error in getTimeEntries: ${error}`);
            throw error;
        }
    }

    /**
     * Get UKG employees using dynamic configuration
     */
    async getEmployees(): Promise<any> {
        try {
            // Use the specific EndpointId for employees (matching current database)
            const endpointId = 'ukgemployeeslist';
            this.context.log(`🔍 Using employees endpoint: ${endpointId}`);
            
            return await this.makeUKGRequest(endpointId);
        } catch (error) {
            this.context.log(`❌ Error in getEmployees: ${error}`);
            throw error;
        }
    }

         /**
      * Get access token for authenticated requests
      */
     private async getAccessToken(): Promise<string | null> {
         try {
             // Check if we have a cached token
             // For now, we'll get a new token each time
             // In production, you'd want to cache this and check expiry
             
             const authResponse = await this.makeUKGRequest('oauth-token');
             return authResponse.access_token;
         } catch (error) {
             this.context.log(`❌ Failed to get access token: ${error}`);
             return null;
         }
     }

    /**
     * Get actual endpoint IDs from database for debugging and fallback configuration
     */
    async getActualEndpointIds(): Promise<any> {
        try {
            const query = `
                SELECT 
                    [Id],
                    [EndpointId],
                    [Name],
                    [Path],
                    [Method],
                    [IsActive]
                FROM [dbo].[UKGTenantEndpoints]
                WHERE [IsActive] = 1
                ORDER BY [Name]
            `;

            const result = await this.dbService.executeQueryWithParams(query);
            
            this.context.log(`📊 Actual endpoint IDs loaded: ${result.length} endpoints available`);
            result.forEach(endpoint => {
                this.context.log(`   - ${endpoint.Name}: EndpointId='${endpoint.EndpointId}', Id='${endpoint.Id}'`);
            });
            
            return result;
        } catch (error) {
            this.context.log(`❌ Error getting actual endpoint IDs: ${error}`);
            return [];
        }
    }

    /**
     * Get endpoint configuration summary for debugging
     */
    async getEndpointSummary(): Promise<any> {
        try {
            const query = `
                SELECT 
                    te.[EndpointId],
                    te.[Name],
                    te.[Path],
                    te.[Method],
                    te.[scan_param],
                    te.[url_param_1],
                    te.[url_param_2],
                    te.[url_param_3],
                    te.[Category]
                FROM [dbo].[UKGTenantEndpoints] te
                WHERE te.[IsActive] = 1
                ORDER BY te.[Category], te.[Name]
            `;

            const result = await this.dbService.executeQueryWithParams(query);
            
            this.context.log(`📊 Endpoint summary loaded: ${result.length} endpoints available`);
            result.forEach(endpoint => {
                this.context.log(`   - ${endpoint.Name} (${endpoint.EndpointId}): ${endpoint.Method} ${endpoint.Path}`);
            });
            
            return result;
        } catch (error) {
            this.context.log(`❌ Error getting endpoint summary: ${error}`);
            return [];
        }
    }
}
