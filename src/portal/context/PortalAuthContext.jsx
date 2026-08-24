import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPortalToken, setPortalToken, clearPortalToken, portalFetch } from '../api/PortalApiClient';

const PortalAuthContext = createContext(null);

export function PortalAuthProvider({ children }) {
  const [token, setToken] = useState(() => getPortalToken());
  const [militar, setMilitar] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const fetchMe = useCallback(async (activeToken) => {
    if (!activeToken) {
      setMilitar(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setAuthError(null);

    try {
      const response = await portalFetch('portal_getMe');
      if (response?.militar) {
        setMilitar(response.militar);
      } else {
        throw new Error('Formato de resposta inválido.');
      }
    } catch (err) {
      console.warn('[PortalAuthContext] Erro ao carregar dados do militar:', err.message);
      setAuthError(err.message || 'Sessão expirada ou inválida.');
      clearPortalToken();
      setToken(null);
      setMilitar(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = getPortalToken();
    if (storedToken) {
      fetchMe(storedToken);
    } else {
      setIsLoading(false);
    }
  }, [fetchMe]);

  const loginWithToken = useCallback(async (newToken) => {
    setPortalToken(newToken);
    setToken(newToken);
    await fetchMe(newToken);
  }, [fetchMe]);

  const logout = useCallback(() => {
    clearPortalToken();
    setToken(null);
    setMilitar(null);
    setAuthError(null);
  }, []);

  const value = {
    token,
    militar,
    isLoading,
    isAuthenticated: Boolean(token && militar),
    authError,
    loginWithToken,
    logout,
    refreshMe: () => fetchMe(token),
  };

  return (
    <PortalAuthContext.Provider value={value}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const context = useContext(PortalAuthContext);
  if (!context) {
    throw new Error('usePortalAuth deve ser utilizado dentro de um PortalAuthProvider.');
  }
  return context;
}
