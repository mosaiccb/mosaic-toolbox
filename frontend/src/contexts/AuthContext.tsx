import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import type { AccountInfo, AuthenticationResult } from '@azure/msal-browser';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalConfig, loginRequest, tokenRequest } from '../config/msalConfig';

interface AuthContextType {
  instance: PublicClientApplication;
  accounts: AccountInfo[];
  isAuthenticated: boolean;
  user: AccountInfo | null;
  login: () => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string | null>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [instance] = useState(() => new PublicClientApplication(msalConfig));
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeMsal = async () => {
      try {
        await instance.initialize();

        // Handle redirect promise
        const response = await instance.handleRedirectPromise();
        if (response) {
          setAccounts(instance.getAllAccounts());
        } else {
          setAccounts(instance.getAllAccounts());
        }
      } catch (error) {
        console.error('MSAL initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeMsal();
  }, [instance]);

  const login = async () => {
    try {
      setLoading(true);
      await instance.loginRedirect(loginRequest);
      // After redirect, accounts will be updated in useEffect
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  };

  const logout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: msalConfig.auth.postLogoutRedirectUri,
    });
  };

  const getToken = async (): Promise<string | null> => {
    try {
      const account = instance.getActiveAccount() || accounts[0];
      if (!account) {
        throw new Error('No active account');
      }

      const response: AuthenticationResult = await instance.acquireTokenSilent({
        ...tokenRequest,
        account,
      });

      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          const account = instance.getActiveAccount() || accounts[0];
          await instance.acquireTokenRedirect({
            ...tokenRequest,
            account,
          });
          // After redirect, token will be available in subsequent calls
          return null;
        } catch (redirectError) {
          console.error('Token acquisition error:', redirectError);
          return null;
        }
      }
      console.error('Token acquisition error:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    instance,
    accounts,
    isAuthenticated: accounts.length > 0,
    user: accounts[0] || null,
    login,
    logout,
    getToken,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};