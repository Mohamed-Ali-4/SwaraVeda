import { useEffect, useState } from 'react';
import axios from 'axios';
import api from './api';

/** A recording that couldn't be sent yet, kept on this device until it can. */
export interface PendingUpload {
  id?: number;
  blob: Blob;
  name: string;
  type: string;
  seconds: number | null;
  details: Record<string, string>;
  consentPublic: boolean;
  consentAi: boolean;
  transcribe: boolean;
  savedAt: string;
}

const DB = 'swaraveda';
const STORE = 'pending-uploads';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

export async function savePending(item: PendingUpload) {
  await run('readwrite', (s) => s.add(item));
  changed();
}

export const listPending = () => run<PendingUpload[]>('readonly', (s) => s.getAll());
const removePending = async (id: number) => {
  await run('readwrite', (s) => s.delete(id));
  changed();
};

/** True when a request failed because there was no connection, not because the server said no. */
export const isOffline = (err: unknown) => !navigator.onLine || (axios.isAxiosError(err) && !err.response);

/** Uploads one recording: audio to storage, then its details, then (optionally) starts transcription. */
export async function sendRecording(item: Omit<PendingUpload, 'id' | 'savedAt'>, onProgress?: (p: number | null) => void) {
  const { data } = await api.post('/recordings/upload-url', { filename: item.name, content_type: item.type });
  await axios.put(data.upload_url, item.blob, {
    headers: { 'Content-Type': item.type || 'application/octet-stream', 'x-upsert': 'true' },
    onUploadProgress: (ev) => onProgress?.(ev.total ? ev.loaded / ev.total : null),
  });
  const rec = (await api.post('/recordings', {
    ...item.details,
    storage_path: data.storage_path,
    duration_seconds: item.seconds ?? undefined,
    consent_public: item.consentPublic,
    consent_ai_training: item.consentAi,
  })).data;
  let transcribing = false;
  if (item.transcribe) transcribing = await api.post(`/recordings/${rec.id}/transcribe`).then(() => true, () => false);
  return { id: rec.id as string, transcribing };
}

let syncing: Promise<number> | null = null;

/** Sends every waiting recording. Stops at the first one that fails, to try again later. Returns how many went. */
export function syncPending(): Promise<number> {
  syncing ??= (async () => {
    let sent = 0;
    try {
      for (const item of await listPending()) {
        if (!navigator.onLine) break;
        try {
          await sendRecording(item);
        } catch {
          break;
        }
        await removePending(item.id!);
        sent++;
      }
    } finally {
      syncing = null;
      changed();
    }
    return sent;
  })();
  changed();
  return syncing;
}

/** How many recordings are waiting on this device, and whether they're being sent right now. */
export function usePendingUploads() {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const refresh = () => {
      setBusy(!!syncing);
      listPending().then((l) => setCount(l.length), () => setCount(0));
    };
    const net = () => setOnline(navigator.onLine);
    listeners.add(refresh);
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    refresh();
    return () => {
      listeners.delete(refresh);
      window.removeEventListener('online', net);
      window.removeEventListener('offline', net);
    };
  }, []);
  return { count, busy, online };
}
