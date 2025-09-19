import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';

// Get public IP information for the Azure Functions backend
export async function getNetworkInfo(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    context.log('Getting network information for Azure Functions backend');

    // Get public IP from multiple services for verification
    const ipServices = [
      { name: 'httpbin.org', url: 'https://httpbin.org/ip' },
      { name: 'ipify.org', url: 'https://api.ipify.org?format=json' },
      { name: 'ip-api.com', url: 'http://ip-api.com/json/?fields=status,message,query,city,region,country,isp,org,timezone' }
    ];

    const ipResults = [];

    for (const service of ipServices) {
      try {
        context.log(`Checking IP with ${service.name}`);
        const response = await axios.get(service.url, { timeout: 10000 });
        
        let ip = '';
        let data = response.data;
        
        // Parse different response formats
        if (service.name === 'httpbin.org') {
          ip = data.origin;
        } else if (service.name === 'ipify.org') {
          ip = data.ip;
        } else if (service.name === 'ip-api.com') {
          ip = data.query;
        }

        ipResults.push({
          service: service.name,
          ip: ip,
          fullResponse: data,
          success: true
        });

        context.log(`${service.name} returned IP: ${ip}`);
      } catch (error) {
        context.warn(`Failed to get IP from ${service.name}:`, error);
        ipResults.push({
          service: service.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }

    // Get Azure-specific metadata if available
    let azureMetadata = null;
    try {
      context.log('Attempting to get Azure Instance Metadata');
      const metadataResponse = await axios.get('http://169.254.169.254/metadata/instance', {
        headers: {
          'Metadata': 'true'
        },
        params: {
          'api-version': '2021-02-01'
        },
        timeout: 5000
      });
      azureMetadata = metadataResponse.data;
      context.log('Azure metadata retrieved successfully');
    } catch (error) {
      context.warn('Could not retrieve Azure metadata (this is normal for some deployment types):', error);
    }

    // Get environment information
    const environmentInfo = {
      WEBSITE_SITE_NAME: process.env.WEBSITE_SITE_NAME,
      WEBSITE_RESOURCE_GROUP: process.env.WEBSITE_RESOURCE_GROUP,
      WEBSITE_OWNER_NAME: process.env.WEBSITE_OWNER_NAME,
      WEBSITE_DEPLOYMENT_ID: process.env.WEBSITE_DEPLOYMENT_ID,
      FUNCTIONS_WORKER_RUNTIME: process.env.FUNCTIONS_WORKER_RUNTIME,
      AZURE_FUNCTIONS_ENVIRONMENT: process.env.AZURE_FUNCTIONS_ENVIRONMENT,
      // Outbound IP related
      WEBSITE_POSSIBLE_OUTBOUND_IPS: process.env.WEBSITE_POSSIBLE_OUTBOUND_IPS,
      WEBSITE_OUTBOUND_IPS: process.env.WEBSITE_OUTBOUND_IPS
    };

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: true,
        timestamp: new Date().toISOString(),
        ipResults: ipResults,
        azureMetadata: azureMetadata,
        environmentInfo: environmentInfo,
        summary: {
          detectedIPs: ipResults.filter(r => r.success).map(r => r.ip),
          uniqueIPs: [...new Set(ipResults.filter(r => r.success).map(r => r.ip))],
          consistentIP: ipResults.filter(r => r.success).every(r => r.ip === ipResults.find(x => x.success)?.ip)
        }
      }
    };

  } catch (error) {
    context.error('Error getting network information:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Test connectivity to a specific host/port (useful for testing SFTP connectivity)
export async function testConnectivity(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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
    const body = await request.json() as any;
    const { host, port, timeout = 10000 } = body;

    if (!host || !port) {
      return {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          success: false,
          error: 'Host and port are required'
        }
      };
    }

    context.log(`Testing connectivity to ${host}:${port}`);

    const net = require('net');
    const startTime = Date.now();

    const testResult = await new Promise<{success: boolean, message: string, connectionTime?: number}>((resolve) => {
      const socket = new net.Socket();
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        const connectionTime = Date.now() - startTime;
        socket.destroy();
        resolve({
          success: true,
          message: `Successfully connected to ${host}:${port}`,
          connectionTime
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          success: false,
          message: `Connection timeout after ${timeout}ms`
        });
      });

      socket.on('error', (error: any) => {
        resolve({
          success: false,
          message: `Connection failed: ${error.message}`
        });
      });

      socket.connect(port, host);
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: testResult.success,
        host,
        port,
        timeout,
        result: testResult,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    context.error('Error testing connectivity:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Register HTTP routes
app.http('getNetworkInfo', {
  methods: ['GET', 'OPTIONS'],
  route: 'network/info',
  handler: getNetworkInfo
});

app.http('testConnectivity', {
  methods: ['POST', 'OPTIONS'],
  route: 'network/test',
  handler: testConnectivity
});