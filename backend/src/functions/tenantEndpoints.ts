import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TenantDatabaseService } from '../services/TenantDatabaseService';

/**
 * Tenant Endpoints API - Manages UKG REST API endpoints for tenants
 * GET /api/v2/tenant-endpoints?tenantId={id} - Get endpoints for a tenant
 * POST /api/v2/tenant-endpoints - Create new endpoint
 * PUT /api/v2/tenant-endpoints?id={id} - Update endpoint
 * DELETE /api/v2/tenant-endpoints?id={id} - Delete endpoint
 */
export async function tenantEndpoints(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Tenant Endpoints API called');
    
    const method = request.method;
    
    try {
        const db = new TenantDatabaseService();
        
        if (method === 'GET') {
            const tenantId = request.query.get('tenantId');
            const endpointId = request.query.get('id');
            
            if (endpointId) {
                // Get specific endpoint
                const endpoint = await db.getTenantEndpointById(endpointId);
                
                if (!endpoint) {
                    return {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            success: false,
                            error: 'Endpoint not found'
                        })
                    };
                }
                
                return {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: true,
                        data: endpoint
                    })
                };
            } else if (tenantId) {
                // Get all endpoints for a tenant
                const endpoints = await db.getTenantEndpoints(tenantId);
                
                return {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: true,
                        data: endpoints
                    })
                };
            } else {
                return {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'tenantId parameter is required'
                    })
                };
            }
        } else if (method === 'POST') {
            // Create new endpoint
            const requestBody = await request.json() as any;
            
            if (!requestBody.tenantId || !requestBody.endpointId || !requestBody.name || !requestBody.path) {
                return {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'tenantId, endpointId, name, and path are required'
                    })
                };
            }
            
            const endpoint = await db.createTenantEndpoint({
                tenantId: requestBody.tenantId,
                endpointId: requestBody.endpointId,
                name: requestBody.name,
                description: requestBody.description,
                category: requestBody.category || 'General',
                path: requestBody.path,
                method: requestBody.method || 'GET',
                version: requestBody.version || 'v2',
                requestTemplate: requestBody.requestTemplate,
                headersJson: requestBody.headersJson,
                authRequired: requestBody.authRequired !== false,
                scope: requestBody.scope
            });
            
            return {
                status: 201,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    data: endpoint
                })
            };
        } else if (method === 'PUT') {
            // Update endpoint
            const endpointId = request.query.get('id');
            if (!endpointId) {
                return {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'id parameter is required'
                    })
                };
            }
            
            const requestBody = await request.json() as any;
            const endpoint = await db.updateTenantEndpoint(endpointId, requestBody);
            
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    data: endpoint
                })
            };
        } else if (method === 'DELETE') {
            // Delete endpoint
            const endpointId = request.query.get('id');
            if (!endpointId) {
                return {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'id parameter is required'
                    })
                };
            }
            
            await db.deleteTenantEndpoint(endpointId);
            
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    message: 'Endpoint deleted successfully'
                })
            };
        } else {
            return {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Method not allowed'
                })
            };
        }
    } catch (error: any) {
        context.error('Error in tenant endpoints API:', error);
        
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error?.message || 'Internal server error'
            })
        };
    }
}

// Register the function
app.http('tenantEndpoints', {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'v2/tenant-endpoints',
    handler: tenantEndpoints
});