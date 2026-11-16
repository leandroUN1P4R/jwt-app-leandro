import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { clearSession, getAccessToken, getRefreshToken, setTokens } from './session';
import type { AuthResponse } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

/** Instância "crua", sem interceptors: usada só para login e refresh. */
export const publicApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

/** Instância usada por todas as telas protegidas. */
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

/* ------------------------------------------------------------------ */
/* 1) Request: anexa o access token                                    */
/* ------------------------------------------------------------------ */
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ------------------------------------------------------------------ */
/* 2) Refresh com fila                                                 */
/*                                                                     */
/* Enquanto um refresh está em andamento, `refreshPromise` guarda a    */
/* promessa. Toda requisição que recebe 401 nesse intervalo apenas     */
/* aguarda (fila) essa MESMA promessa, então só sai UMA chamada para   */
/* /auth/refresh, mesmo que 5 requisições falhem ao mesmo tempo.       */
/* ------------------------------------------------------------------ */
let refreshPromise: Promise<string> | null = null;

export class SessionExpiredError extends Error {
  constructor() {
    super('Sua sessão expirou. Faça login novamente.');
  }
}

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new SessionExpiredError();

      const { data } = await publicApi.post<AuthResponse>('/auth/refresh', { refreshToken });
      // Rotação: a API revogou o refresh antigo e mandou um novo par.
      setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Limpa tudo e avisa o AuthProvider, que leva o usuário para o login. */
function endSession() {
  clearSession();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth:expired'));
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/* ------------------------------------------------------------------ */
/* 3) Response: em 401, renova uma única vez e repete a requisição     */
/* ------------------------------------------------------------------ */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true; // garante "uma única vez" por requisição
    try {
      const newToken = await refreshAccessToken();
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch {
      // Refresh inválido/expirado/revogado → limpa sessão e vai para o login
      endSession();
      return Promise.reject(new SessionExpiredError());
    }
  },
);

export default api;

/* ------------------------------------------------------------------ */
/* Utilitários de resposta                                             */
/* ------------------------------------------------------------------ */

/** Aceita lista pura, { data: [] }, { rows: [] } ou { items: [] } (paginação). */
export function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['data', 'rows', 'items', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

/** Extrai a mensagem de erro enviada pela API (ex.: 409 Conflict). */
export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error instanceof SessionExpiredError) return error.message;
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | string | undefined;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      const msg = data.message ?? data.error ?? data.msg;
      if (typeof msg === 'string') return msg;
      if (Array.isArray(data.errors) && data.errors.length) {
        return data.errors
          .map((e: unknown) => (typeof e === 'string' ? e : (e as { message?: string }).message))
          .filter(Boolean)
          .join(' · ');
      }
    }
    if (!error.response) return 'Não foi possível conectar à API. Ela está rodando?';
    if (error.response.status === 403) return 'Acesso negado: recurso exclusivo de administradores.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
