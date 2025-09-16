import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from '../services/TenantDatabaseService';

// Initialize the database service
const dbService = new TenantDatabaseService();

/**
 * Get all tenants
 * GET /api/tenants
 */
export async function getTenants(_request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        context.log('Getting all tenants from database');
        
        const tenants = await dbService.getAllTenants();
        
        context.log(`Retrieved ${tenants.length} tenants`);
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: {
                success: true,
                data: tenants,
                count: tenants.length
            }
        };
    } catch (error) {
        context.error('Error getting tenants:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                success: false,
                error: 'Failed to retrieve tenants',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
}

/**
 * Get tenant by ID
 * GET /api/tenants/{id}
 */
export async function getTenantById(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const tenantId = request.params.id;
        
        if (!tenantId) {
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant ID is required'
                }
            };
        }
        
        context.log(`Getting tenant by ID: ${tenantId}`);
        
        const tenant = await dbService.getTenantById(tenantId);
        
        if (!tenant) {
            return {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant not found'
                }
            };
        }
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: {
                success: true,
                data: tenant
            }
        };
    } catch (error) {
        context.error('Error getting tenant:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                success: false,
                error: 'Failed to retrieve tenant',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
}

/**
 * Create new tenant
 * POST /api/tenants
 */
export async function createTenant(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const body = await request.json() as any;
        
        // Validate required fields
        const requiredFields = ['tenantName', 'companyId', 'baseUrl', 'clientId', 'clientSecret'];
        const missingFields = requiredFields.filter(field => !body[field]);
        
        if (missingFields.length > 0) {
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: `Missing required fields: ${missingFields.join(', ')}`
                }
            };
        }
        
        context.log(`Creating new tenant: ${body.tenantName}`);
        
        const newTenantId = await dbService.createTenant({
            tenantName: body.tenantName,
            companyId: body.companyId,
            baseUrl: body.baseUrl,
            clientId: body.clientId,
            clientSecret: body.clientSecret,
            description: body.description
        });
        
        context.log(`Created tenant with ID: ${newTenantId}`);
        
        // Get the created tenant to return full data
        const createdTenant = await dbService.getTenantById(newTenantId);
        
        return {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: {
                success: true,
                data: createdTenant,
                message: 'Tenant created successfully'
            }
        };
    } catch (error) {
        context.error('Error creating tenant:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                success: false,
                error: 'Failed to create tenant',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
}

/**
 * Update tenant
 * PUT /api/tenants/{id}
 */
export async function updateTenant(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const tenantId = request.params.id;
        const body = await request.json() as any;
        
        if (!tenantId) {
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant ID is required'
                }
            };
        }
        
        // For update operations, we allow partial updates
        // Only validate that at least one field is provided
        const updateFields = ['tenantName', 'companyId', 'baseUrl', 'clientId', 'clientSecret', 'description', 'isActive'];
        const hasUpdateFields = updateFields.some(field => body[field] !== undefined);
        
        if (!hasUpdateFields) {
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'At least one field must be provided for update'
                }
            };
        }
        
        context.log(`Updating tenant: ${tenantId}`);
        
        // Get current tenant data first
        const currentTenant = await dbService.getTenantById(tenantId);
        if (!currentTenant) {
            return {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant not found'
                }
            };
        }
        
        // Merge updates with current data
        const success = await dbService.updateTenant({
            id: tenantId,
            tenantName: body.tenantName || currentTenant.tenantName,
            companyId: body.companyId || currentTenant.companyId,
            baseUrl: body.baseUrl || currentTenant.baseUrl,
            clientId: body.clientId || currentTenant.clientId,
            clientSecret: body.clientSecret,
            description: body.description !== undefined ? body.description : currentTenant.description,
            isActive: body.isActive !== undefined ? body.isActive : currentTenant.isActive
        });
        
        if (!success) {
            return {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant not found'
                }
            };
        }
        
        // Get the updated tenant to return full data
        const updatedTenant = await dbService.getTenantById(tenantId);
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: {
                success: true,
                data: updatedTenant,
                message: 'Tenant updated successfully'
            }
        };
    } catch (error) {
        context.error('Error updating tenant:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                success: false,
                error: 'Failed to update tenant',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
}

/**
 * Delete tenant
 * DELETE /api/tenants/{id}
 */
export async function deleteTenant(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const tenantId = request.params.id;
        
        if (!tenantId) {
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant ID is required'
                }
            };
        }
        
        context.log(`Deleting tenant: ${tenantId}`);
        
        const success = await dbService.deleteTenant(tenantId);
        
        if (!success) {
            return {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant not found'
                }
            };
        }
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: {
                success: true,
                message: 'Tenant deleted successfully'
            }
        };
    } catch (error) {
        context.error('Error deleting tenant:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                success: false,
                error: 'Failed to delete tenant',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
}

/**
 * Get tenant credentials (for OAuth token generation)
 * GET /api/tenants/{id}/credentials
 */
export async function getTenantCredentials(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const tenantId = request.params.id;
        
        if (!tenantId) {
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant ID is required'
                }
            };
        }
        
        context.log(`Getting credentials for tenant: ${tenantId}`);
        
        // Get tenant config from database
        const tenant = await dbService.getTenantById(tenantId);
        if (!tenant) {
            return {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Tenant not found'
                }
            };
        }
        
        // Get client secret from Key Vault
        const clientSecret = await dbService.getClientSecret(tenantId);
        if (!clientSecret) {
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: {
                    success: false,
                    error: 'Client secret not found'
                }
            };
        }
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: {
                success: true,
                data: {
                    tenantId: tenant.id,
                    tenantName: tenant.tenantName,
                    companyId: tenant.companyId,
                    baseUrl: tenant.baseUrl,
                    clientId: tenant.clientId,
                    clientSecret: clientSecret,
                    tokenEndpoint: tenant.tokenEndpoint
                }
            }
        };
    } catch (error) {
        context.error('Error getting tenant credentials:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                success: false,
                error: 'Failed to retrieve tenant credentials',
                details: error instanceof Error ? error.message : 'Unknown error'
            }
        };
    }
}

/**
 * Combined handler for /api/tenants route
 * Handles GET (list all) and POST (create) methods
 */
export async function tenantsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const method = request.method;
    
    if (method === 'OPTIONS') {
        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
    }
    
    if (method === 'GET') {
        return await getTenants(request, context);
    } else if (method === 'POST') {
        return await createTenant(request, context);
    } else {
        return {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                success: false,
                error: 'Method not allowed'
            }
        };
    }
}

/**
 * Combined handler for /api/tenants/{id} route
 * Handles GET (by ID), PUT (update), and DELETE methods
 */
export async function tenantByIdHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const method = request.method;
    
    if (method === 'OPTIONS') {
        return {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
    }
    
    if (method === 'GET') {
        return await getTenantById(request, context);
    } else if (method === 'PUT') {
        return await updateTenant(request, context);
    } else if (method === 'DELETE') {
        return await deleteTenant(request, context);
    } else {
        return {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: {
                success: false,
                error: 'Method not allowed'
            }
        };
    }
}

// Register the functions
app.http('tenants', {
    methods: ['GET', 'POST', 'OPTIONS'],
    route: 'tenants',
    handler: tenantsHandler
});

app.http('tenantById', {
    methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
    route: 'tenants/{id}',
    handler: tenantByIdHandler
});

app.http('getTenantCredentials', {
    methods: ['GET', 'OPTIONS'],
    route: 'tenants/{id}/credentials',
    handler: getTenantCredentials
});
