import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  apiClient,
  getStoredToken,
  setStoredToken,
  setUnauthorizedHandler,
} from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      const token = getStoredToken();
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const res = await apiClient.get('/auth/me');
        if (active) setUser(res.data.user);
      } catch {
        setStoredToken(null);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    hydrate();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const res = await apiClient.post('/auth/login', { email, password });
    setStoredToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async ({ name, email, password }) => {
    const res = await apiClient.post('/auth/register', { name, email, password });
    setStoredToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
