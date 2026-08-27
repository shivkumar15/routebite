import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const { data } = await api.get('/auth/me');
        if (active) setUser(data.data.user);
      } catch (error) {
        if (active) {
          if (error.response?.status !== 401) {
            console.error('Failed to restore session', error);
          }
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function register(payload) {
    const { data } = await api.post('/auth/register', payload);
    setUser(data.data.user);
    return data.data.user;
  }

  async function login(payload) {
    const { data } = await api.post('/auth/login', payload);
    setUser(data.data.user);
    return data.data.user;
  }

  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, register, login, logout }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
