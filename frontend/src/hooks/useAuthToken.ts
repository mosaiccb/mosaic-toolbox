import { useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { tokenRequest } from '../config/msalConfig';

export const useAuthToken = () => {
  const { instance, accounts } = useMsal();

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const account = instance.getActiveAccount() || accounts[0];
      if (!account) {
        console.warn('No active account found for token acquisition');
        return null;
      }

      const response = await instance.acquireTokenSilent({
        ...tokenRequest,
        account,
      });

      return response.accessToken;
    } catch (error) {
      console.warn('Token acquisition failed:', error);
      return null;
    }
  }, [instance, accounts]);

  return { getToken };
};