import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TenantDatabaseService } from "../services/TenantDatabaseService";
import * as crypto from 'crypto';

const dbService = new TenantDatabaseService();

export interface UkgWebhookEvent {
  id?: number;
  webhookConfigurationId: number;
  tenantId: string;
  ukgEventType: string; // 'AccountCreated', 'EmployeeHired', 'PayrollProcessed', etc.
  ukgCompanyId?: string;
  ukgEventId?: string;
  sourceIp?: string;
  userAgent?: string;
  authMethod: 'basic' | 'bearer' | 'oauth' | 'none';
  authValid: boolean;
  headers?: string; // JSON
  payload: string; // JSON
  processedFields?: string; // JSON - extracted field data
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingAttempts: number;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  processingError?: string;
  receivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Specialized UKG Ready webhook receiver
export async function receiveUkgWebhook(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`UKG webhook receiver called with method: ${request.method}, URL: ${request.url}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  if (request.method !== 'POST') {
    return {
      status: 405,
      jsonBody: { success: false, error: 'Method not allowed' }
    };
  }

  try {
    // Extract tenant ID and webhook path from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    
    // UKG webhook path format: /api/ukg-webhooks/{tenantId}/{webhookPath}
    const webhookPath = pathParts.slice(4).join('/') || 'default'; // Remove '/api/ukg-webhooks/{tenantId}'
    
    context.log(`Processing UKG webhook for tenant ${tenantId}, path: ${webhookPath}`);

    // Find webhook configuration
    const config = await findUkgWebhookConfiguration(tenantId, webhookPath);
    if (!config) {
      return {
        status: 404,
        jsonBody: { success: false, error: 'UKG webhook configuration not found' }
      };
    }

    if (!config.isActive) {
      return {
        status: 403,
        jsonBody: { success: false, error: 'UKG webhook is deactivated' }
      };
    }

    // Validate authentication
    const authResult = await validateUkgAuthentication(request, config);
    if (!authResult.valid && config.authMethod !== 'none') {
      return {
        status: 401,
        jsonBody: { 
          success: false, 
          error: 'Authentication failed',
          authMethod: config.authMethod 
        }
      };
    }

    // Get request body
    let payload: any;
    try {
      const requestText = await request.text();
      payload = JSON.parse(requestText);
    } catch (error) {
      context.log('Failed to parse webhook payload:', error);
      return {
        status: 400,
        jsonBody: { success: false, error: 'Invalid JSON payload' }
      };
    }

    // Extract UKG-specific event information
    const ukgEventType = extractUkgEventType(payload);
    const ukgCompanyId = payload.CompanyId || payload.companyId || '';
    const ukgEventId = payload.EventId || payload.eventId || payload.Id || '';

    // Process and extract configured fields
    const processedFields = extractConfiguredFields(payload, config.configurationJson);

    // Store the webhook event
    const eventId = await storeUkgWebhookEvent({
      webhookConfigurationId: config.id!,
      tenantId,
      ukgEventType,
      ukgCompanyId,
      ukgEventId,
      sourceIp: getClientIP(request),
      userAgent: request.headers.get('user-agent') || '',
      authMethod: config.authMethod,
      authValid: authResult.valid,
      headers: JSON.stringify(Object.fromEntries(request.headers.entries())),
      payload: JSON.stringify(payload),
      processedFields: JSON.stringify(processedFields),
      processingStatus: 'pending',
      processingAttempts: 0,
      receivedAt: new Date().toISOString()
    });

    // Trigger processing (could be async queue in production)
    setTimeout(() => processUkgWebhookEvent(eventId, config, payload, processedFields), 100);

    return {
      status: 202, // Accepted
      jsonBody: {
        success: true,
        message: 'UKG webhook received successfully',
        eventId,
        ukgEventType,
        ukgCompanyId,
        authValid: authResult.valid,
        fieldsProcessed: Object.keys(processedFields).length
      }
    };

  } catch (error) {
    context.log('Error processing UKG webhook:', error);
    return {
      status: 500,
      jsonBody: { success: false, error: 'Internal server error' }
    };
  }
}

// Find UKG webhook configuration
async function findUkgWebhookConfiguration(tenantId: string, endpointPath: string): Promise<any> {
  const query = `
    SELECT * FROM WebhookConfigurations 
    WHERE tenantId = @tenantId 
    AND (endpointPath = @endpointPath OR endpointPath = @endpointPathWithSlash)
    AND webhookType = 'ukg-ready'
  `;
  
  const result = await dbService.executeQueryWithParams(query, [
    { name: 'tenantId', type: 'uniqueidentifier', value: tenantId },
    { name: 'endpointPath', type: 'nvarchar', value: endpointPath },
    { name: 'endpointPathWithSlash', type: 'nvarchar', value: `/${endpointPath}` }
  ]);

  return result[0] || null;
}

// Validate UKG authentication
async function validateUkgAuthentication(request: HttpRequest, config: any): Promise<{ valid: boolean; error?: string }> {
  const authMethod = config.authMethod || 'none';

  switch (authMethod) {
    case 'basic':
      return validateBasicAuth(request, config);
    case 'bearer':
      return validateBearerToken(request, config);
    case 'oauth':
      return validateOAuthToken(request, config);
    case 'none':
      return { valid: true };
    default:
      return { valid: false, error: 'Unknown authentication method' };
  }
}

function validateBasicAuth(request: HttpRequest, config: any): { valid: boolean; error?: string } {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Basic ')) {
    return { valid: false, error: 'Missing Basic authentication' };
  }

  try {
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
    const [username, password] = credentials.split(':');
    
    const configData = JSON.parse(config.configurationJson || '{}');
    return {
      valid: username === configData.username && password === configData.password
    };
  } catch (error) {
    return { valid: false, error: 'Invalid Basic authentication format' };
  }
}

function validateBearerToken(request: HttpRequest, config: any): { valid: boolean; error?: string } {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing Bearer token' };
  }

  const token = authHeader.substring(7);
  const configData = JSON.parse(config.configurationJson || '{}');
  return {
    valid: token === configData.token
  };
}

function validateOAuthToken(request: HttpRequest, config: any): { valid: boolean; error?: string } {
  // OAuth validation would typically involve verifying the token with the OAuth provider
  // For now, we'll do a simple token check - in production, use proper OAuth validation
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing OAuth token' };
  }

  const token = authHeader.substring(7);
  const configData = JSON.parse(config.configurationJson || '{}');
  
  // In production, validate token with OAuth provider using configData.oauthUrl, clientId, clientSecret
  return {
    valid: token && token.length > 10 // Basic validation
  };
}

// Extract UKG event type from payload
function extractUkgEventType(payload: any): string {
  return payload.EventType || payload.eventType || 
         payload.Action || payload.action ||
         payload.Type || payload.type || 'unknown';
}

// Extract configured fields from payload
function extractConfiguredFields(payload: any, configurationJson: string): any {
  try {
    const config = JSON.parse(configurationJson || '{}');
    const selectedFields = config.selectedFields || [];
    
    const extracted: any = {};
    for (const field of selectedFields) {
      if (payload.hasOwnProperty(field)) {
        extracted[field] = payload[field];
      }
    }
    
    return extracted;
  } catch (error) {
    return {};
  }
}

// Store UKG webhook event
async function storeUkgWebhookEvent(event: any): Promise<number> {
  const query = `
    INSERT INTO WebhookEvents (
      webhookConfigurationId, tenantId, eventType, sourceIp, userAgent,
      headers, payload, signature, isSignatureValid, processingStatus, 
      processingAttempts, receivedAt, createdAt
    )
    OUTPUT INSERTED.id
    VALUES (
      @webhookConfigurationId, @tenantId, @eventType, @sourceIp, @userAgent,
      @headers, @payload, @signature, @isSignatureValid, @processingStatus,
      @processingAttempts, @receivedAt, @createdAt
    )
  `;

  const result = await dbService.executeQueryWithParams(query, [
    { name: 'webhookConfigurationId', type: 'int', value: event.webhookConfigurationId },
    { name: 'tenantId', type: 'uniqueidentifier', value: event.tenantId },
    { name: 'eventType', type: 'nvarchar', value: event.ukgEventType },
    { name: 'sourceIp', type: 'nvarchar', value: event.sourceIp },
    { name: 'userAgent', type: 'nvarchar', value: event.userAgent },
    { name: 'headers', type: 'ntext', value: event.headers },
    { name: 'payload', type: 'ntext', value: event.payload },
    { name: 'signature', type: 'nvarchar', value: null },
    { name: 'isSignatureValid', type: 'bit', value: event.authValid },
    { name: 'processingStatus', type: 'nvarchar', value: event.processingStatus },
    { name: 'processingAttempts', type: 'int', value: event.processingAttempts },
    { name: 'receivedAt', type: 'datetime2', value: event.receivedAt },
    { name: 'createdAt', type: 'datetime2', value: new Date() }
  ]);

  return result[0].id;
}

// Process UKG webhook event (placeholder for business logic)
async function processUkgWebhookEvent(eventId: number, config: any, payload: any, processedFields: any): Promise<void> {
  // This is where you would implement your business logic
  // For example:
  // - Sync employee data when EmployeeHired event is received
  // - Update payroll information when PayrollProcessed event is received
  // - Trigger notifications or other workflows
  
  console.log(`Processing UKG event ${eventId}:`, {
    eventType: payload.EventType || payload.eventType,
    companyId: payload.CompanyId || payload.companyId,
    fields: processedFields
  });
}

// Get client IP address
function getClientIP(request: HttpRequest): string {
  return request.headers.get('x-forwarded-for') ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         'unknown';
}

// Register UKG webhook receiver with tenant-specific routing
app.http('receiveUkgWebhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'ukg-webhooks/{tenantId}/{*path}', // /api/ukg-webhooks/{tenantId}/{path}
  handler: receiveUkgWebhook
});