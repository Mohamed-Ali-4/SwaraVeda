import { useCallback, useEffect, useState } from 'react';
import api from './api';
import type { Dialect } from './types';

let cache: Promise<Dialect[]> | null = null;

/** The dialect list, fetched once and shared by every page. */
export function useDialects() {
  const [dialects, setDialects] = useState<Dialect[]>([]);
  useEffect(() => {
    cache ??= api.get('/dialects', { params: { page_size: 200 } }).then((r) => r.data).catch(() => {
      cache = null;
      return [];
    });
    cache.then(setDialects);
  }, []);
  const reload = useCallback(async () => {
    cache = api.get('/dialects', { params: { page_size: 200 } }).then((r) => r.data);
    setDialects(await cache!);
  }, []);
  const nameOf = useCallback((id?: string) => dialects.find((d) => d.id === id)?.name, [dialects]);
  return { dialects, nameOf, reload };
}
