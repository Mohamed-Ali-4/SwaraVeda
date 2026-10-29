import { useCallback, useEffect, useState } from 'react';
import api from './api';
import { safeLocal } from './storage';
import type { Dialect } from './types';

let cache: Promise<Dialect[]> | null = null;

/** The dialect list, fetched once and shared by every page. */
export function useDialects() {
  const [dialects, setDialects] = useState<Dialect[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    cache ??= api.get('/dialects', { params: { page_size: 200 } })
      .then((r) => {
        safeLocal.set('dialects', JSON.stringify(r.data));
        return r.data;
      })
      .catch(() => {
        cache = null;
        // Offline: the list from the last visit still lets you tag a recording.
        try {
          return JSON.parse(safeLocal.get('dialects') || '[]');
        } catch {
          return [];
        }
      });
    cache.then((list) => {
      setDialects(list);
      setLoading(false);
    });
  }, []);
  const reload = useCallback(async () => {
    cache = api.get('/dialects', { params: { page_size: 200 } }).then((r) => r.data);
    setDialects(await cache!);
  }, []);
  const nameOf = useCallback((id?: string) => dialects.find((d) => d.id === id)?.name, [dialects]);
  return { dialects, nameOf, reload, loading };
}
