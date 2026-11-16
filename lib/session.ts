import type { User } from './types';

/**
 * Armazenamento da sessão no navegador.
 *
 * Os tokens ficam no localStorage (ver README: riscos e motivos da escolha).
 * Além disso gravamos um cookie "has_session" SEM valor sensível, só para o
 * proxy.ts conseguir redirecionar para o login antes de renderizar a página.
 * Quem decide de verdade se a sessão é válida é a API (401/403).
 */
const ACCESS_KEY = 'biblioteca.accessToken';
const REFRESH_KEY = 'biblioteca.refreshToken';
const USER_KEY = 'biblioteca.user';
export const SESSION_COOKIE = 'has_session';

const isBrowser = () => typeof window !== 'undefined';

function safeGet(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return safeGet(ACCESS_KEY);
}

export function getRefreshToken() {
  return safeGet(REFRESH_KEY);
}

export function getStoredUser(): User | null {
  const raw = safeGet(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (!isBrowser()) return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  // 7 dias, mesma validade do refresh token
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}

export function setStoredUser(user: User) {
  if (!isBrowser()) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

/** Lê o payload de um JWT (sem validar assinatura; isso é papel da API). */
export function decodeJwt<T = Record<string, unknown>>(token: string): T | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json))) as T;
  } catch {
    return null;
  }
}
