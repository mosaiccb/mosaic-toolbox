import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';

// MSAL Configuration
const msalConfig: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
  },
};

const pca = new ConfidentialClientApplication(msalConfig);

/**
 * Entra SSO Authentication Function
 * Handles authentication using Microsoft Entra ID
 */
export async function entraAuth(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      };
    }

    context.log('Entra auth request started');

    // For simplicity, this function can handle token acquisition for the app
    // In a real scenario, you might handle user login or token validation

    const scopes = ['https://graph.microsoft.com/.default'];

    const tokenRequest = {
      scopes: scopes,
    };

    const response = await pca.acquireTokenByClientCredential(tokenRequest);

    if (response && response.accessToken) {
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          access_token: response.accessToken,
          expires_on: response.expiresOn?.getTime(),
        }
      };
    } else {
      return {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        jsonBody: {
          error: 'token_acquisition_failed',
          error_description: 'Failed to acquire access token'
        }
      };
    }

  } catch (error) {
    context.log('Error in entraAuth:', error);
    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      jsonBody: {
        error: 'internal_server_error',
        error_description: error.message
      }
    };
  }
}

app.http('entraAuth', {
  methods: ['GET', 'POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: entraAuth
});