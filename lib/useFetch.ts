'use client';

import { useCallback, useEffect, useState } from 'react';
import api, { getErrorMessage } from './api';

interface Result<T> {
  key: string | null;
  data: T;
  error: string | null;
}

/**
 * Busca um recurso da API e expõe { data, loading, error, reload, setData }.
 * `url` = null pausa a busca. `select` transforma a resposta e deve ser
 * definido fora do componente (referência estável).
 */
export function useFetch<T>(url: string | null, select: (raw: unknown) => T, initial: T) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: null, data: initial, error: null });
  const key = url ? `${url}#${version}` : null;

  useEffect(() => {
    if (!url || !key) return;
    let cancelled = false;
    api
      .get(url)
      .then((res) => {
        if (!cancelled) setResult({ key, data: select(res.data), error: null });
      })
      .catch((err) => {
        if (!cancelled) setResult((r) => ({ key, data: r.data, error: getErrorMessage(err) }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // "Carregando" = a última resposta recebida não é da URL/versão atual
  const loading = key !== null && result.key !== key;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (update: (data: T) => T) => setResult((r) => ({ ...r, data: update(r.data) })),
    [],
  );

  return { data: result.data, loading, error: loading ? null : result.error, reload, setData };
}
