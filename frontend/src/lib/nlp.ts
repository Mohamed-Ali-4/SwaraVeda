import { useEffect, useState } from 'react';
import api from './api';

export interface NlpStatus {
  transcription: boolean;
  translation: boolean;
  semantic_search: boolean;
}

const OFF: NlpStatus = { transcription: false, translation: false, semantic_search: false };
let cached: Promise<NlpStatus> | null = null;

/** Which AI features the server has configured. Fetched once per page load. */
export function useNlpStatus(): NlpStatus | null {
  const [status, setStatus] = useState<NlpStatus | null>(null);
  useEffect(() => {
    cached ??= api.get('/nlp/status').then((r) => r.data).catch(() => OFF);
    cached.then(setStatus);
  }, []);
  return status;
}
