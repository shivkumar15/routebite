import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

const EMPTY_PARTNER = {
  exists: false,
  verificationStatus: null,
  availabilityStatus: null,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [partner, setPartner] = useState(EMPTY_PARTNER);
  const [loading, setLoading] = useState(true);

  async function refreshSession() {
    const { data } = await api.get('/auth/me');
    setUser(data.data.user);
    setPartner(data.data.partner ?? EMPTY_PARTNER);
    return data.data;
  }

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const { data } = await api.get('/auth/me');
        if (active) {
          setUser(data.data.user);
          setPartner(data.data.partner ?? EMPTY_PARTNER);
        }
      } catch (error) {
        if (active) {
          if (error.response?.status !== 401) {
            console.error('Failed to restore session', error);
          }
          setUser(null);
          setPartner(EMPTY_PARTNER);
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
    setPartner(EMPTY_PARTNER);
    return data.data.user;
  }

  async function login(payload) {
    const { data } = await api.post('/auth/login', payload);
    setUser(data.data.user);
    setPartner(EMPTY_PARTNER);
    await refreshSession();
    return data.data.user;
  }

  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
    setPartner(EMPTY_PARTNER);
  }

  const value = useMemo(
    () => ({ user, partner, loading, register, login, logout, refreshSession }),
    [user, partner, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
