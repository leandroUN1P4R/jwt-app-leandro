'use client';

import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { publicApi } from '@/lib/api';
import {
  clearSession,
  decodeJwt,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setStoredUser,
  setTokens,
} from '@/lib/session';
import type { AuthResponse, User } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: User | null;
  status: Status;
  isAdmin: boolean;
  /** true quando a sessão caiu sozinha (refresh inválido/expirado). */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [sessionExpired, setSessionExpired] = useState(false);

  // Restaura a sessão ao abrir/recarregar a página confirmando com GET /auth/me.
  // Se o access token já expirou, o interceptor renova sozinho antes de responder.
  useEffect(() => {
    let cancelled = false;
    const hadSession = Boolean(getAccessToken() || getRefreshToken());
    const request: Promise<User> = hadSession
      ? api.get('/auth/me').then(({ data }) => (data?.user ?? data) as User)
      : Promise.reject(new Error('no-session'));

    request
      .then((me) => {
        if (cancelled) return;
        setStoredUser(me);
        setUser(me);
        setStatus('authenticated');
      })
      .catch((err) => {
        if (cancelled) return;
        // API fora do ar, mas sessão local existe: mantém o usuário em cache.
        const cached = getStoredUser();
        if (axios.isAxiosError(err) && !err.response && cached && getRefreshToken()) {
          setUser(cached);
          setStatus('authenticated');
          return;
        }
        clearSession();
        setUser(null);
        setStatus('unauthenticated');
        if (hadSession) setSessionExpired(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Sessão encerrada pelo interceptor (refresh falhou) ou logout em outra aba
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setStatus('unauthenticated');
      setSessionExpired(true);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'biblioteca.refreshToken' && !e.newValue) {
        setUser(null);
        setStatus('unauthenticated');
      }
    };
    window.addEventListener('auth:expired', onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:expired', onExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await publicApi.post<AuthResponse>('/auth/login', { email, password });
    setTokens(data.accessToken, data.refreshToken);
    const loggedUser = data.user ?? (decodeJwt<User>(data.accessToken) as User);
    setStoredUser(loggedUser);
    setUser(loggedUser);
    setSessionExpired(false);
    setStatus('authenticated');
    return loggedUser;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // Mesmo que a API falhe, a sessão local é encerrada.
    } finally {
      clearSession();
      setUser(null);
      setSessionExpired(false);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, isAdmin: Boolean(user?.isAdmin), sessionExpired, login, logout }),
    [user, status, sessionExpired, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
