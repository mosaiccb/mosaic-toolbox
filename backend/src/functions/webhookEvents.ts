import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TenantDatabaseService } from "../services/TenantDatabaseService";

const dbService = new TenantDatabaseService();

export interface WebhookEvent {
  id?: number;
  webhookConfigurationId: number;
  tenantId: string;
  eventId?: string;
  eventType: string;
  sourceIp?: string;
  userAgent?: string;
  headers?: string;
  payload: string;
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

// Get webhook events with filtering and pagination
export async function getWebhookEvents(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`getWebhookEvents called with method: ${request.method}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const url = new URL(request.url);
    
    // Query parameters
    const configId = url.searchParams.get('configId');
    const eventType = url.searchParams.get('eventType');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const signatureValid = url.searchParams.get('signatureValid');

    context.log('Getting webhook events for tenant:', tenantId);

    let whereClause = 'WHERE e.TenantId = @tenantId';
    const parameters: Array<{name: string, type: string, value: any}> = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ];

    if (configId) {
      whereClause += ' AND e.WebhookConfigurationId = @configId';
      parameters.push({ name: 'configId', type: 'int', value: parseInt(configId) });
    }

    if (eventType) {
      whereClause += ' AND e.EventType = @eventType';
      parameters.push({ name: 'eventType', type: 'nvarchar', value: eventType });
    }

    if (status) {
      whereClause += ' AND e.ProcessingStatus = @status';
      parameters.push({ name: 'status', type: 'nvarchar', value: status });
    }

    if (signatureValid === 'true' || signatureValid === 'false') {
      whereClause += ' AND e.IsSignatureValid = @signatureValid';
      parameters.push({ name: 'signatureValid', type: 'bit', value: signatureValid === 'true' });
    }

    const query = `
      SELECT e.Id, e.WebhookConfigurationId, e.TenantId, e.EventId, e.EventType,
             e.SourceIp, e.UserAgent, e.IsSignatureValid, e.ProcessingStatus,
             e.ProcessingAttempts, e.ProcessingStartedAt, e.ProcessingCompletedAt,
             e.ProcessingError, e.ReceivedAt, e.CreatedAt, e.UpdatedAt,
             c.Name as WebhookName, c.WebhookType
      FROM dbo.WebhookEvents e
      INNER JOIN dbo.WebhookConfigurations c ON e.WebhookConfigurationId = c.Id
      ${whereClause}
      ORDER BY e.ReceivedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    parameters.push({ name: 'offset', type: 'int', value: offset });
    parameters.push({ name: 'limit', type: 'int', value: Math.min(limit, 1000) }); // Cap at 1000

    const events = await dbService.executeQueryWithParams(query, parameters);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as Total
      FROM dbo.WebhookEvents e
      INNER JOIN dbo.WebhookConfigurations c ON e.WebhookConfigurationId = c.Id
      ${whereClause}
    `;

    const countResult = await dbService.executeQueryWithParams(countQuery, parameters.filter(p => p.name !== 'offset' && p.name !== 'limit'));

    const result = events.map((row: any) => ({
      id: row.Id,
      webhookConfigurationId: row.WebhookConfigurationId,
      webhookName: row.WebhookName,
      webhookType: row.WebhookType,
      tenantId: row.TenantId,
      eventId: row.EventId,
      eventType: row.EventType,
      sourceIp: row.SourceIp,
      userAgent: row.UserAgent,
      isSignatureValid: row.IsSignatureValid,
      processingStatus: row.ProcessingStatus,
      processingAttempts: row.ProcessingAttempts,
      processingStartedAt: row.ProcessingStartedAt,
      processingCompletedAt: row.ProcessingCompletedAt,
      processingError: row.ProcessingError,
      receivedAt: row.ReceivedAt,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt
    }));

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: result,
        count: result.length,
        total: countResult[0].Total,
        offset: offset,
        limit: limit
      }
    };

  } catch (error) {
    context.error('Error getting webhook events:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to retrieve webhook events',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Get single webhook event with full payload
export async function getWebhookEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`getWebhookEvent called with method: ${request.method}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const eventId = parseInt(request.params.id || '0');

    if (isNaN(eventId)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Invalid webhook event ID' }
      };
    }

    const query = `
      SELECT e.Id, e.WebhookConfigurationId, e.TenantId, e.EventId, e.EventType,
             e.SourceIp, e.UserAgent, e.Headers, e.Payload, e.Signature,
             e.IsSignatureValid, e.ProcessingStatus, e.ProcessingAttempts,
             e.ProcessingStartedAt, e.ProcessingCompletedAt, e.ProcessingError,
             e.ReceivedAt, e.CreatedAt, e.UpdatedAt,
             c.Name as WebhookName, c.WebhookType, c.EndpointPath
      FROM dbo.WebhookEvents e
      INNER JOIN dbo.WebhookConfigurations c ON e.WebhookConfigurationId = c.Id
      WHERE e.Id = @eventId AND e.TenantId = @tenantId
    `;

    const result = await dbService.executeQueryWithParams(query, [
      { name: 'eventId', type: 'bigint', value: eventId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    if (result.length === 0) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Webhook event not found' }
      };
    }

    const row = result[0];
    const event = {
      id: row.Id,
      webhookConfigurationId: row.WebhookConfigurationId,
      webhookName: row.WebhookName,
      webhookType: row.WebhookType,
      endpointPath: row.EndpointPath,
      tenantId: row.TenantId,
      eventId: row.EventId,
      eventType: row.EventType,
      sourceIp: row.SourceIp,
      userAgent: row.UserAgent,
      headers: row.Headers ? JSON.parse(row.Headers) : null,
      payload: row.Payload ? JSON.parse(row.Payload) : null,
      signature: row.Signature,
      isSignatureValid: row.IsSignatureValid,
      processingStatus: row.ProcessingStatus,
      processingAttempts: row.ProcessingAttempts,
      processingStartedAt: row.ProcessingStartedAt,
      processingCompletedAt: row.ProcessingCompletedAt,
      processingError: row.ProcessingError,
      receivedAt: row.ReceivedAt,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt
    };

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: event
      }
    };

  } catch (error) {
    context.error('Error getting webhook event:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to retrieve webhook event',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Get webhook statistics
export async function getWebhookStats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`getWebhookStats called with method: ${request.method}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id',
      },
    };
  }

  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const url = new URL(request.url);
    const configId = url.searchParams.get('configId');

    let whereClause = 'WHERE e.TenantId = @tenantId';
    const parameters: Array<{name: string, type: string, value: any}> = [
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ];

    if (configId) {
      whereClause += ' AND e.WebhookConfigurationId = @configId';
      parameters.push({ name: 'configId', type: 'int', value: parseInt(configId) });
    }

    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as TotalEvents,
        COUNT(CASE WHEN ProcessingStatus = 'completed' THEN 1 END) as CompletedEvents,
        COUNT(CASE WHEN ProcessingStatus = 'failed' THEN 1 END) as FailedEvents,
        COUNT(CASE WHEN ProcessingStatus = 'pending' THEN 1 END) as PendingEvents,
        COUNT(CASE WHEN ProcessingStatus = 'processing' THEN 1 END) as ProcessingEvents,
        COUNT(CASE WHEN IsSignatureValid = 1 THEN 1 END) as ValidSignatures,
        COUNT(CASE WHEN IsSignatureValid = 0 THEN 1 END) as InvalidSignatures,
        AVG(CAST(ProcessingAttempts as FLOAT)) as AvgProcessingAttempts
      FROM dbo.WebhookEvents e
      ${whereClause}
    `;

    const statsResult = await dbService.executeQueryWithParams(statsQuery, parameters);

    // Get events by type
    const eventTypesQuery = `
      SELECT EventType, COUNT(*) as Count
      FROM dbo.WebhookEvents e
      ${whereClause}
      GROUP BY EventType
      ORDER BY Count DESC
    `;

    const eventTypesResult = await dbService.executeQueryWithParams(eventTypesQuery, parameters);

    // Get recent activity (last 24 hours by hour)
    const recentActivityQuery = `
      SELECT 
        DATEPART(HOUR, ReceivedAt) as Hour,
        COUNT(*) as EventCount
      FROM dbo.WebhookEvents e
      ${whereClause} AND ReceivedAt >= DATEADD(HOUR, -24, GETUTCDATE())
      GROUP BY DATEPART(HOUR, ReceivedAt)
      ORDER BY Hour
    `;

    const recentActivityResult = await dbService.executeQueryWithParams(recentActivityQuery, parameters);

    const stats = statsResult[0];
    const eventTypes = eventTypesResult.map((row: any) => ({
      eventType: row.EventType,
      count: row.Count
    }));

    const recentActivity = recentActivityResult.map((row: any) => ({
      hour: row.Hour,
      count: row.EventCount
    }));

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        data: {
          overview: {
            totalEvents: stats.TotalEvents,
            completedEvents: stats.CompletedEvents,
            failedEvents: stats.FailedEvents,
            pendingEvents: stats.PendingEvents,
            processingEvents: stats.ProcessingEvents,
            validSignatures: stats.ValidSignatures,
            invalidSignatures: stats.InvalidSignatures,
            avgProcessingAttempts: Math.round((stats.AvgProcessingAttempts || 0) * 100) / 100
          },
          eventTypes: eventTypes,
          recentActivity: recentActivity
        }
      }
    };

  } catch (error) {
    context.error('Error getting webhook statistics:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to retrieve webhook statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Retry failed webhook event processing
export async function retryWebhookEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`retryWebhookEvent called with method: ${request.method}`);

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

  try {
    const tenantId = request.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000000';
    const eventId = parseInt(request.params.id || '0');

    if (isNaN(eventId)) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { success: false, error: 'Invalid webhook event ID' }
      };
    }

    // Reset event status to pending for retry
    const query = `
      UPDATE dbo.WebhookEvents
      SET ProcessingStatus = 'pending',
          ProcessingStartedAt = NULL,
          ProcessingCompletedAt = NULL,
          ProcessingError = NULL,
          UpdatedAt = GETUTCDATE()
      WHERE Id = @eventId AND TenantId = @tenantId
    `;

    await dbService.executeQueryWithParams(query, [
      { name: 'eventId', type: 'bigint', value: eventId },
      { name: 'tenantId', type: 'uniqueidentifier', value: tenantId }
    ]);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        message: 'Webhook event queued for retry'
      }
    };

  } catch (error) {
    context.error('Error retrying webhook event:', error);
    return {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      jsonBody: {
        success: false,
        error: 'Failed to retry webhook event',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// Register webhook events management endpoints
app.http('getWebhookEvents', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/events',
  handler: getWebhookEvents
});

app.http('getWebhookEvent', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/events/{id}',
  handler: getWebhookEvent
});

app.http('getWebhookStats', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/stats',
  handler: getWebhookStats
});

app.http('retryWebhookEvent', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'webhooks/events/{id}/retry',
  handler: retryWebhookEvent
});