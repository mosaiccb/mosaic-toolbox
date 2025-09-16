import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from '../services/TenantDatabaseService';
import axios from 'axios';

// Initialize the database service
const dbService = new TenantDatabaseService();

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * OAuth Token Proxy Function
 * Handles OAuth token requests for multiple tenants using SQL + Key Vault architecture
 */
export async function oauthToken(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      };
    }

    context.log('OAuth token request started');

    // Get tenant ID from request body
    const body = await request.json() as any;
    const tenantId = body.tenantId;

    if (!tenantId) {
      context.log('No tenant ID provided');
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          error: 'tenant_id_required',
          error_description: 'tenantId is required in request body'
        }
      };
    }

    context.log(`Processing OAuth token request for tenant: ${tenantId}`);

    // Get tenant configuration from database
    const tenant = await dbService.getTenantById(tenantId);
    if (!tenant) {
      context.log(`Tenant not found: ${tenantId}`);
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          error: 'tenant_not_found',
          error_description: `Tenant with ID ${tenantId} not found`
        }
      };
    }

    // Get client secret from Key Vault
    const clientSecret = await dbService.getClientSecret(tenantId);
    if (!clientSecret) {
      context.log(`Client secret not found for tenant: ${tenantId}`);
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          error: 'client_secret_not_found',
          error_description: 'Client secret not found in Key Vault'
        }
      };
    }

    // Prepare OAuth token request
    const tokenEndpoint = tenant.tokenEndpoint || `${tenant.baseUrl}/api/v1/security/oauth2/token`;
    const tokenParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: tenant.clientId,
      client_secret: clientSecret,
      scope: tenant.scope || 'read write'
    });

    context.log(`Making OAuth request to: ${tokenEndpoint}`);

    // Make OAuth token request to UKG
    const response = await axios.post<TokenResponse>(tokenEndpoint, tokenParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'UKG-Sync-Backend/1.0.0'
      },
      timeout: 30000
    });

    context.log(`OAuth token obtained successfully for tenant: ${tenantId}`);

    // Return the token response
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      jsonBody: {
        access_token: response.data.access_token,
        token_type: response.data.token_type,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        tenant_id: tenantId,
        tenant_name: tenant.tenantName,
        company_id: tenant.companyId
      }
    };

  } catch (error) {
    context.error('OAuth token request failed:', error);

    // Handle axios errors
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data;

      context.log(`OAuth request failed with status ${status}:`, errorData);

      return {
        status: status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          error: 'oauth_request_failed',
          error_description: errorData?.error_description || error.message || 'Failed to obtain OAuth token',
          status_code: status,
          details: errorData
        }
      };
    }

    // Handle other errors
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        error: 'internal_server_error',
        error_description: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }
    };
  }
}

/**
 * Test OAuth Token Function
 * Test endpoint to validate OAuth token functionality
 */
export async function testOAuthToken(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      };
    }

    context.log('Test OAuth token request started');

    // Get all tenants to test with
    const tenants = await dbService.getAllTenants();
    if (tenants.length === 0) {
      return {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          error: 'no_tenants_found',
          error_description: 'No tenants configured in the system'
        }
      };
    }

    // Use the first tenant for testing
    const testTenant = tenants[0];
    context.log(`Testing OAuth with tenant: ${testTenant.tenantName} (${testTenant.id})`);

    // Get client secret from Key Vault
    const clientSecret = await dbService.getClientSecret(testTenant.id);
    if (!clientSecret) {
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          error: 'client_secret_not_found',
          error_description: 'Client secret not found in Key Vault'
        }
      };
    }

    // Test OAuth token request
    const tokenEndpoint = testTenant.tokenEndpoint || `${testTenant.baseUrl}/api/v1/security/oauth2/token`;
    const tokenParams = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: testTenant.clientId,
      client_secret: clientSecret,
      scope: testTenant.scope || 'read write'
    });

    const response = await axios.post<TokenResponse>(tokenEndpoint, tokenParams, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'UKG-Sync-Backend/1.0.0'
      },
      timeout: 30000
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      jsonBody: {
        success: true,
        message: 'OAuth token test successful',
        tenant: {
          id: testTenant.id,
          name: testTenant.tenantName,
          companyId: testTenant.companyId
        },
        token: {
          access_token: response.data.access_token.substring(0, 20) + '...',
          token_type: response.data.token_type,
          expires_in: response.data.expires_in,
          scope: response.data.scope
        }
      }
    };

  } catch (error) {
    context.error('Test OAuth token request failed:', error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data;

      return {
        status: status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'oauth_test_failed',
          error_description: errorData?.error_description || error.message || 'Failed to test OAuth token',
          status_code: status,
          details: errorData
        }
      };
    }

    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: 'internal_server_error',
        error_description: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    };
  }
}

// Register the functions
app.http('oauthToken', {
  methods: ['POST', 'OPTIONS'],
  route: 'oauth/token',
  handler: oauthToken
});

app.http('testOAuthToken', {
  methods: ['POST', 'OPTIONS'],
  route: 'oauth/test',
  handler: testOAuthToken
});
