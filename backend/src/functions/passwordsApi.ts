import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PasswordDatabaseService, type PasswordEntry, type CreatePasswordRequest, type UpdatePasswordRequest } from '../services/PasswordDatabaseService';

// Initialize the password database service
let passwordService: PasswordDatabaseService | null = null;

async function getPasswordService(): Promise<PasswordDatabaseService> {
    if (!passwordService) {
        passwordService = new PasswordDatabaseService();
        // Initialize the database table if needed
        await passwordService.initializeDatabase();
    }
    return passwordService;
}

// GET /api/passwords - Get all password entries
export async function getPasswords(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Getting password entries');
    
    try {
        const service = await getPasswordService();
        const entries = await service.getAllPasswords();
        
        // Convert Date objects to ISO strings for JSON serialization
        const serializedEntries = entries.map(entry => ({
            ...entry,
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString()
        }));
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: serializedEntries
        };
    } catch (error) {
        context.error('Error getting passwords:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: { error: 'Failed to retrieve password entries' }
        };
    }
}

// GET /api/passwords/{id} - Get specific password entry with decrypted password
export async function getPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const id = request.params.id;
    context.log('Getting password entry:', id);
    
    try {
        const service = await getPasswordService();
        const entry = await service.getPasswordById(id);
        
        if (!entry) {
            return {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: { error: 'Password entry not found' }
            };
        }

        // Convert Date objects to ISO strings for JSON serialization
        const serializedEntry = {
            ...entry,
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString()
        };
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: serializedEntry
        };
    } catch (error) {
        context.error('Error getting password:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: { error: 'Failed to retrieve password' }
        };
    }
}

// POST /api/passwords - Create new password entry
export async function createPassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Creating new password entry');
    
    try {
        // Log the raw request body for debugging
        const rawBody = await request.text();
        context.log('Raw request body:', rawBody);
        
        let requestData: CreatePasswordRequest;
        try {
            requestData = JSON.parse(rawBody) as CreatePasswordRequest;
        } catch (parseError) {
            context.log('JSON parsing error:', parseError);
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: { error: 'Invalid JSON format in request body' }
            };
        }
        
        if (!requestData.title || !requestData.password) {
            return {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: { error: 'Title and password are required' }
            };
        }

        const service = await getPasswordService();
        const passwordId = await service.createPassword({
            ...requestData,
            createdBy: 'api-user'
        });
        
        // Get the created entry to return
        const createdEntry = await service.getPasswordById(passwordId);
        
        if (!createdEntry) {
            throw new Error('Failed to retrieve created password entry');
        }

        // Convert Date objects to ISO strings for JSON serialization (excluding password)
        const { password, ...entryWithoutPassword } = createdEntry;
        const serializedEntry = {
            ...entryWithoutPassword,
            createdAt: createdEntry.createdAt.toISOString(),
            updatedAt: createdEntry.updatedAt.toISOString()
        };
        
        return {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: serializedEntry
        };
    } catch (error) {
        context.error('Error creating password:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: { error: 'Failed to create password entry' }
        };
    }
}

// PUT /api/passwords/{id} - Update password entry
export async function updatePassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const id = request.params.id;
    context.log('Updating password entry:', id);
    
    try {
        const service = await getPasswordService();
        const requestData = await request.json() as UpdatePasswordRequest;
        
        const success = await service.updatePassword(id, {
            ...requestData,
            updatedBy: 'api-user'
        });
        
        if (!success) {
            return {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: { error: 'Password entry not found' }
            };
        }

        // Get the updated entry to return
        const updatedEntry = await service.getPasswordById(id);
        
        if (!updatedEntry) {
            throw new Error('Failed to retrieve updated password entry');
        }

        // Convert Date objects to ISO strings for JSON serialization (excluding password)
        const { password, ...entryWithoutPassword } = updatedEntry;
        const serializedEntry = {
            ...entryWithoutPassword,
            createdAt: updatedEntry.createdAt.toISOString(),
            updatedAt: updatedEntry.updatedAt.toISOString()
        };
        
        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            jsonBody: serializedEntry
        };
    } catch (error) {
        context.error('Error updating password:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: { error: 'Failed to update password entry' }
        };
    }
}

// DELETE /api/passwords/{id} - Delete password entry
export async function deletePassword(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const id = request.params.id;
    context.log('Deleting password entry:', id);
    
    try {
        const service = await getPasswordService();
        const success = await service.deletePassword(id);
        
        if (!success) {
            return {
                status: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: { error: 'Password entry not found' }
            };
        }
        
        return {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        };
    } catch (error) {
        context.error('Error deleting password:', error);
        return {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            jsonBody: { error: 'Failed to delete password entry' }
        };
    }
}

// Register the HTTP functions
app.http('getPasswords', {
    methods: ['GET'],
    route: 'passwords',
    authLevel: 'anonymous',
    handler: getPasswords
});

app.http('getPassword', {
    methods: ['GET'],
    route: 'passwords/{id}',
    authLevel: 'anonymous',
    handler: getPassword
});

app.http('createPassword', {
    methods: ['POST'],
    route: 'passwords',
    authLevel: 'anonymous',
    handler: createPassword
});

app.http('updatePassword', {
    methods: ['PUT'],
    route: 'passwords/{id}',
    authLevel: 'anonymous',
    handler: updatePassword
});

app.http('deletePassword', {
    methods: ['DELETE'],
    route: 'passwords/{id}',
    authLevel: 'anonymous',
    handler: deletePassword
});