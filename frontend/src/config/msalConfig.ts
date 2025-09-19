import type { Configuration } from '@azure/msal-browser';
import { LogLevel } from '@azure/msal-browser';

// MSAL configuration for Microsoft Entra ID
export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '0c745f9c-2645-47aa-9fa7-929237a0313d',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'a06810f5-b832-45e2-a50f-945ed8fae797'}`,
    redirectUri: import.meta.env.VITE_REDIRECT_URI || 'https://nice-moss-0c8cc2510.2.azurestaticapps.net',
    postLogoutRedirectUri: import.meta.env.VITE_POST_LOGOUT_REDIRECT_URI || 'https://nice-moss-0c8cc2510.2.azurestaticapps.net',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true, // Enable cookie storage for better compatibility
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            console.info(message);
            return;
          case LogLevel.Verbose:
            console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
        }
      },
      logLevel: LogLevel.Info,
    },
  },
};

// Login request configuration
export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};

// Token request for API calls
export const tokenRequest = {
  scopes: ['https://graph.microsoft.com/User.Read'],
};