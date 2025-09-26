import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TenantDatabaseService } from "../services/TenantDatabaseService";
import * as crypto from 'crypto';

const dbService = new TenantDatabaseService();

export interface WebhookConfiguration {
  id?: number;
  tenantId: string;
  name: string;
  description?: string;
  endpointPath: string;
  secretKey: string;
  isActive: boolean;
  allowedSources?: string[]; // IP addresses or domains
  webhookType: string; // 'github', 'stripe', 'custom', etc.
  configurationJson?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface WebhookEvent {
  id?: number;
  webhookConfigurationId: number;
  tenantId: string;
  eventId?: string;
  eventType: string;
  sourceIp?: string;
  userAgent?: string;
  headers?: string; // JSON
  payload: string; // JSON
  signature?: string;
  isSignatureValid?: boolean;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingAttempts: number;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  processingError?: string;
  receivedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Generic webhook receiver - handles any webhook endpoint
export async function receiveWebhook(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`Webhook receiver called with method: ${request.method}, URL: ${request.url}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id, x-hub-signature, x-hub-signature-256, x-stripe-signature',
      },
    };
  }

  if (request.method !== 'POST') {
    return {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: { success: false, error: 'Method not allowed. Only POST requests are accepted.' }
    };
  }

  try {
    // Extract webhook path from URL
    const url = new URL(request.url);
    const fullPath = url.pathname.replace('/api', ''); // Remove /api prefix
    // Convert from /webhooks/endpoint/{path} to /webhooks/{path} for database lookup
    const webhookPath = fullPath.replace('/webhooks/endpoint/', '/webhooks/');
    
    context.log('Processing webhook for path:', webhookPath, 'from full path:', fullPath);

    // Get request details
    const sourceIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const signature = request.headers.get('x-hub-signature') || 
                     request.headers.get('x-hub-signature-256') || 
                     request.headers.get('x-stripe-signature') || '';

    // Collect all headers for audit
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Get raw payload
    const payloadText = await request.text();
    context.log('Payload size:', payloadText.length);

    // Find webhook configuration
    const configQuery = `
      SELECT Id, TenantId, Name, SecretKey, IsActive, AllowedSources, WebhookType, ConfigurationJson
      FROM dbo.WebhookConfigurations 
      WHERE EndpointPath = @endpointPath AND IsActive = 1
    `;

    const configResult = await dbService.executeQueryWithParams(configQuery, [
      { name: 'endpointPath', type: 'nvarchar', value: webhookPath }
    ]);

    if (configResult.length === 0) {
      context.warn(`No active webhook configuration found for path: ${webhookPath}`);
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Webhook endpoint not found' }
      };
    }

    const config = configResult[0];
    context.log(`Found webhook configuration: ${config.Name} (ID: ${config.Id})`);

    // Validate source IP if restrictions are configured
    if (config.AllowedSources) {
      const allowedSources = JSON.parse(config.AllowedSources);
      if (!isSourceAllowed(sourceIp, allowedSources)) {
        context.warn(`Source IP ${sourceIp} not allowed for webhook ${config.Name}`);
        return {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: false, error: 'Source not allowed' }
        };
      }
    }

    // Validate signature
    let isSignatureValid = false;
    if (signature && config.SecretKey) {
      isSignatureValid = validateSignature(payloadText, signature, config.SecretKey, config.WebhookType);
      if (!isSignatureValid) {
        context.warn(`Invalid signature for webhook ${config.Name}`);
        // Store the event even if signature is invalid for security audit
      }
    }

    // Parse payload to extract event type
    let eventType = 'unknown';
    let eventId = '';
    try {
      // Log the raw payload for debugging
      context.log('Raw payload received:', payloadText);
      
      if (!payloadText || payloadText.trim() === '') {
        context.warn('Empty payload received');
        eventType = 'empty';
        eventId = 'empty-' + Date.now();
      } else {
        const payload = JSON.parse(payloadText);
        eventType = extractEventType(payload, config.WebhookType);
        eventId = extractEventId(payload, config.WebhookType);
        context.log('Parsed payload successfully - EventType:', eventType, 'EventId:', eventId);
      }
    } catch (error) {
      context.warn('Failed to parse payload as JSON:', error);
      context.warn('Payload content:', payloadText.substring(0, 200)); // Log first 200 chars
      eventType = 'invalid-json';
      eventId = 'invalid-' + Date.now();
    }

    // Store webhook event
    const insertEventQuery = `
      INSERT INTO dbo.WebhookEvents (
        WebhookConfigurationId, TenantId, EventId, EventType, SourceIp, UserAgent,
        Headers, Payload, Signature, IsSignatureValid, ProcessingStatus, 
        ProcessingAttempts, ReceivedAt
      ) VALUES (
        @configId, @tenantId, @eventId, @eventType, @sourceIp, @userAgent,
        @headers, @payload, @signature, @isSignatureValid, 'pending',
        0, GETUTCDATE()
      );
      SELECT SCOPE_IDENTITY() as EventId;
    `;

    const eventResult = await dbService.executeQueryWithParams(insertEventQuery, [
      { name: 'configId', type: 'int', value: config.Id },
      { name: 'tenantId', type: 'uniqueidentifier', value: config.TenantId },
      { name: 'eventId', type: 'nvarchar', value: eventId },
      { name: 'eventType', type: 'nvarchar', value: eventType },
      { name: 'sourceIp', type: 'nvarchar', value: sourceIp },
      { name: 'userAgent', type: 'nvarchar', value: userAgent },
      { name: 'headers', type: 'nvarchar', value: JSON.stringify(headers) },
      { name: 'payload', type: 'nvarchar', value: payloadText },
      { name: 'signature', type: 'nvarchar', value: signature },
      { name: 'isSignatureValid', type: 'bit', value: isSignatureValid }
    ]);

    const storedEventId = eventResult[0]?.EventId;
    context.log(`Stored webhook event with ID: ${storedEventId}`);

    // Return success response
    const responseBody = {
      success: true,
      message: 'Webhook received successfully',
      eventId: storedEventId,
      eventType: eventType,
      signatureValid: isSignatureValid
    };

    // Return appropriate status code based on signature validation
    const statusCode = isSignatureValid || !signature ? 200 : 202; // 202 for invalid signature but still processed

    return {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: responseBody
    };

  } catch (error) {
    context.error('Error processing webhook:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: { 
        success: false, 
        error: 'Internal server error processing webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Validate webhook signature based on webhook type
function validateSignature(payload: string, signature: string, secret: string, webhookType: string): boolean {
  try {
    switch (webhookType.toLowerCase()) {
      case 'github':
        return validateGitHubSignature(payload, signature, secret);
      case 'stripe':
        return validateStripeSignature(payload, signature, secret);
      default:
        // Generic HMAC SHA256 validation
        return validateGenericHmacSignature(payload, signature, secret);
    }
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}

// GitHub webhook signature validation
function validateGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  // Ensure both strings are the same length for timingSafeEqual
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
}

// Stripe webhook signature validation  
function validateStripeSignature(payload: string, signature: string, secret: string): boolean {
  // Stripe signature format: t=timestamp,v1=signature
  const elements = signature.split(',');
  const signatureHash = elements.find(element => element.startsWith('v1='))?.substring(3);
  if (!signatureHash) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const expectedSignature = hmac.digest('hex');
  
  // Ensure both strings are the same length for timingSafeEqual
  if (signatureHash.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(Buffer.from(signatureHash, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
}

// Generic HMAC SHA256 signature validation
function validateGenericHmacSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const expectedSignature = hmac.digest('hex');
  
  // Handle both prefixed (sha256=) and non-prefixed signatures
  const receivedSignature = signature.startsWith('sha256=') ? signature.substring(7) : signature;
  
  // Ensure both strings are the same length for timingSafeEqual
  if (receivedSignature.length !== expectedSignature.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(Buffer.from(receivedSignature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
}

// Check if source IP is allowed
function isSourceAllowed(sourceIp: string, allowedSources: string[]): boolean {
  if (!allowedSources || allowedSources.length === 0) return true;
  
  // Remove port if present
  const cleanIp = sourceIp.split(':')[0];
  
  return allowedSources.some(allowed => {
    if (allowed === '*') return true;
    if (allowed.includes('/')) {
      // CIDR notation support could be added here
      return false;
    }
    return allowed === cleanIp || allowed === sourceIp;
  });
}

// Extract event type from payload based on webhook type
function extractEventType(payload: any, webhookType: string): string {
  switch (webhookType.toLowerCase()) {
    case 'github':
      return payload.action ? `${payload.action}` : (payload.zen ? 'ping' : 'unknown');
    case 'stripe':
      return payload.type || 'unknown';
    case 'ukg-ready':
      return payload.EventType || payload.eventType || 'ukg-event';
    default:
      return payload.event_type || payload.type || payload.action || payload.EventType || 'webhook';
  }
}

// Extract event ID from payload based on webhook type
function extractEventId(payload: any, webhookType: string): string {
  switch (webhookType.toLowerCase()) {
    case 'github':
      return payload.delivery || payload.hook_id || '';
    case 'stripe':
      return payload.id || '';
    case 'ukg-ready':
      return payload.EventId || payload.eventId || '';
    default:
      return payload.id || payload.event_id || payload.uuid || payload.EventId || '';
  }
}

// Register the webhook receiver for endpoint paths (not management endpoints)
app.http('receiveWebhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/endpoint/{*path}', // Catch webhook endpoint paths under /api/webhooks/endpoint/
  handler: receiveWebhook
});