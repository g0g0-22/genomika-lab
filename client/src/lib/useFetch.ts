import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Minimal data-fetching hook: enough for this site, nothing more. */
export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce(n => n + 1), []);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.code ?? 'error'); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data, loading, error, reload };
}
