import { InvocationContext } from '@azure/functions';

// UKG Ready API Configuration
interface UkgReadyConfig {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
    companyShortName: string;
}

// UKG Ready Authentication Response
interface UkgReadyAuthResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
}

// UKG Ready Employee Payload
interface UkgReadyEmployeePayload {
    employeeNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    personalEmail?: string;
    homePhone?: string;
    hireDate: string;
    terminationDate?: string;
    jobTitle?: string;
    department?: string;
    location?: string;
    payRate?: number;
    isActive: boolean;
    ssn?: string;
    birthDate?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
}

// UKG Ready API Response
interface UkgReadyApiResponse {
    success: boolean;
    employeeId?: string;
    errors?: string[];
    warnings?: string[];
}

// UKG Ready Batch Response
interface UkgReadyBatchResponse {
    totalProcessed: number;
    successful: number;
    failed: number;
    results: UkgReadyApiResponse[];
    errors: string[];
}

/**
 * UKG Ready API Service
 * Handles authentication and employee data operations with UKG Ready
 */
export class UkgReadyApiService {
    private config: UkgReadyConfig;
    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;
    private context: InvocationContext;

    constructor(config: UkgReadyConfig, context: InvocationContext) {
        this.config = config;
        this.context = context;
    }

    /**
     * Authenticate with UKG Ready API
     */
    async authenticate(): Promise<void> {
        this.context.log('🔐 Authenticating with UKG Ready API...');

        const authUrl = `${this.config.baseUrl}/authentication/access_token`;
        const authPayload = {
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            username: this.config.username,
            password: this.config.password,
            grant_type: 'password',
            scope: 'employee_management'
        };

        try {
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: new URLSearchParams(authPayload)
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
            }

            const authData: UkgReadyAuthResponse = await response.json();
            
            this.accessToken = authData.access_token;
            this.tokenExpiry = new Date(Date.now() + (authData.expires_in * 1000));
            
            this.context.log('✅ UKG Ready authentication successful');
        } catch (error: any) {
            this.context.log('❌ UKG Ready authentication failed:', error);
            throw new Error(`UKG Ready authentication failed: ${error.message}`);
        }
    }

    /**
     * Ensure we have a valid access token
     */
    private async ensureValidToken(): Promise<void> {
        if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
            await this.authenticate();
        }
    }

    /**
     * Create or update a single employee in UKG Ready
     */
    async createOrUpdateEmployee(employee: UkgReadyEmployeePayload): Promise<UkgReadyApiResponse> {
        await this.ensureValidToken();

        const employeeUrl = `${this.config.baseUrl}/personnel/v1/${this.config.companyShortName}/employees`;
        
        // Transform to UKG Ready format
        const ukgPayload = {
            employeeNumber: employee.employeeNumber,
            firstName: employee.firstName,
            lastName: employee.lastName,
            middleName: employee.middleName,
            personalContact: {
                email: employee.personalEmail,
                homePhone: employee.homePhone,
                address: employee.address ? {
                    line1: employee.address.street,
                    city: employee.address.city,
                    state: employee.address.state,
                    postalCode: employee.address.zipCode
                } : undefined
            },
            employmentStatus: {
                hireDate: employee.hireDate,
                terminationDate: employee.terminationDate,
                isActive: employee.isActive
            },
            jobInformation: {
                jobTitle: employee.jobTitle,
                department: employee.department,
                location: employee.location,
                payRate: employee.payRate
            },
            personalInformation: {
                ssn: employee.ssn,
                birthDate: employee.birthDate
            }
        };

        try {
            const response = await fetch(employeeUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(ukgPayload)
            });

            const result = await response.json();

            if (response.ok) {
                return {
                    success: true,
                    employeeId: result.employeeId || employee.employeeNumber,
                    warnings: result.warnings || []
                };
            } else {
                return {
                    success: false,
                    errors: result.errors || [`HTTP ${response.status}: ${response.statusText}`]
                };
            }
        } catch (error: any) {
            this.context.log(`❌ Failed to create/update employee ${employee.employeeNumber}:`, error);
            return {
                success: false,
                errors: [error.message]
            };
        }
    }

    /**
     * Batch create/update employees in UKG Ready
     */
    async batchCreateOrUpdateEmployees(employees: UkgReadyEmployeePayload[]): Promise<UkgReadyBatchResponse> {
        this.context.log(`📦 Processing batch of ${employees.length} employees for UKG Ready...`);

        const batchResults: UkgReadyApiResponse[] = [];
        const batchErrors: string[] = [];
        let successful = 0;
        let failed = 0;

        // Process in smaller batches to avoid rate limits
        const BATCH_SIZE = 10;
        for (let i = 0; i < employees.length; i += BATCH_SIZE) {
            const batch = employees.slice(i, i + BATCH_SIZE);
            
            this.context.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(employees.length/BATCH_SIZE)}...`);

            // Process batch items concurrently
            const batchPromises = batch.map(employee => this.createOrUpdateEmployee(employee));
            const batchResults_chunk = await Promise.allSettled(batchPromises);

            batchResults_chunk.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    batchResults.push(result.value);
                    if (result.value.success) {
                        successful++;
                    } else {
                        failed++;
                        batchErrors.push(`Employee ${batch[index].employeeNumber}: ${result.value.errors?.join(', ')}`);
                    }
                } else {
                    failed++;
                    batchErrors.push(`Employee ${batch[index].employeeNumber}: ${result.reason}`);
                    batchResults.push({
                        success: false,
                        errors: [result.reason.toString()]
                    });
                }
            });

            // Add a small delay between batches to be respectful of API limits
            if (i + BATCH_SIZE < employees.length) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
        }

        const batchResponse: UkgReadyBatchResponse = {
            totalProcessed: employees.length,
            successful,
            failed,
            results: batchResults,
            errors: batchErrors
        };

        this.context.log(`✅ Batch processing complete: ${successful} successful, ${failed} failed`);
        return batchResponse;
    }

    /**
     * Test UKG Ready API connection
     */
    async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
        try {
            await this.authenticate();
            
            // Test a simple API call to verify connection
            const testUrl = `${this.config.baseUrl}/personnel/v1/${this.config.companyShortName}/employees?limit=1`;
            
            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                return {
                    success: true,
                    message: 'UKG Ready API connection successful',
                    details: {
                        status: response.status,
                        hasEmployees: result.data?.length > 0
                    }
                };
            } else {
                return {
                    success: false,
                    message: `UKG Ready API test failed: ${response.status} ${response.statusText}`
                };
            }
        } catch (error: any) {
            return {
                success: false,
                message: `UKG Ready connection test failed: ${error.message}`
            };
        }
    }

    /**
     * Get employee count from UKG Ready (for validation)
     */
    async getEmployeeCount(): Promise<number> {
        await this.ensureValidToken();

        try {
            const countUrl = `${this.config.baseUrl}/personnel/v1/${this.config.companyShortName}/employees/count`;
            
            const response = await fetch(countUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                return result.count || 0;
            } else {
                this.context.log(`Failed to get employee count: ${response.status}`);
                return -1;
            }
        } catch (error: any) {
            this.context.log('Error getting employee count:', error);
            return -1;
        }
    }
}

export { UkgReadyConfig, UkgReadyEmployeePayload, UkgReadyApiResponse, UkgReadyBatchResponse };
