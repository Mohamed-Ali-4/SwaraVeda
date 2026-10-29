// Preview build only (VITE_PREVIEW=1): answers the app's API calls in the
// browser so the pages can be tried where the real server can't be reached.
// Nothing is saved; a reload starts over.
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import api from '../lib/api';
import seed from './dialects.json';

interface User {
  id: string;
  display_name: string;
  email: string;
  phone?: string | null;
  role: string;
  native_dialect?: string | null;
}

const dialects = (seed as { name: string; region?: string; script?: string; description?: string; iso_code?: string; asr_language?: string }[])
  .map((d, i) => ({ id: `dialect-${i + 1}`, ...d }))
  .sort((a, b) => a.name.localeCompare(b.name));

let user: User | null = null;
const TOKEN = 'preview-token';

const titleCase = (s: string) => s.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

function reply(config: InternalAxiosRequestConfig, status: number, data: unknown): Promise<AxiosResponse> {
  const res = { data, status, statusText: String(status), headers: {}, config } as AxiosResponse;
  if (status < 400) return new Promise((ok) => setTimeout(() => ok(res), 250));
  const err = new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, res);
  return new Promise((_, fail) => setTimeout(() => fail(err), 250));
}

const OFFLINE = 'This needs the live server, so it isn’t available in the preview.';

const adapter: AxiosAdapter = (config) => {
  const method = (config.method || 'get').toLowerCase();
  const path = (config.url || '').split('?')[0];
  const body = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : config.data || {};
  const params = config.params || {};
  const signedIn = !!user && String(config.headers?.Authorization || '').endsWith(TOKEN);

  if (path === '/auth/config') return reply(config, 200, { google_client_id: null });
  if (path === '/auth/google') return reply(config, 503, { detail: 'Google sign-in isn’t switched on in the preview.' });
  if (path === '/auth/login' && method === 'post') {
    const ident = String(body.email || '').trim();
    if (!ident || !body.password) return reply(config, 401, { detail: 'Incorrect email, mobile number or password' });
    const isEmail = ident.includes('@');
    user = {
      id: 'preview-user', role: 'contributor', native_dialect: null,
      display_name: titleCase(isEmail ? ident.split('@')[0] : 'Guest'),
      email: isEmail ? ident : 'guest@example.com',
      phone: isEmail ? null : ident,
    };
    return reply(config, 200, { access_token: TOKEN, token_type: 'bearer' });
  }
  if (path === '/auth/register' && method === 'post') {
    user = {
      id: 'preview-user', role: 'contributor', native_dialect: body.native_dialect ?? null,
      display_name: body.display_name, email: body.email, phone: body.phone ?? null,
    };
    return reply(config, 201, { access_token: TOKEN, token_type: 'bearer' });
  }
  if (path === '/auth/me') {
    if (!signedIn) return reply(config, 401, { detail: 'Not signed in' });
    if (method === 'patch') user = { ...user!, ...body };
    return reply(config, 200, user);
  }

  if (method === 'get') {
    if (path === '/dialects') return reply(config, 200, dialects);
    if (path.startsWith('/dialects/')) {
      const d = dialects.find((x) => x.id === path.slice('/dialects/'.length));
      return d ? reply(config, 200, d) : reply(config, 404, { detail: 'Dialect not found' });
    }
    if (path === '/recordings') return reply(config, 200, { items: [], total: 0, page: params.page ?? 1, page_size: params.page_size ?? 20 });
    if (path === '/stats') {
      return reply(config, 200, {
        recordings: 0, verified_recordings: 0, segments: 0, verified_segments: 0,
        dialects: dialects.length, contributors: user ? 1 : 0, total_seconds: 0,
      });
    }
    if (path === '/review/segments') return reply(config, 200, { counts: { needs_correction: 0, needs_verification: 0, verified: 0 }, items: [] });
    if (path === '/search' || path === '/search/semantic') return reply(config, 200, []);
    if (path === '/nlp/status') return reply(config, 200, { transcription: false, translation: false, semantic_search: false });
    if (path === '/tags') return reply(config, 200, []);
    if (path === '/admin/users') return reply(config, 200, user ? [{ ...user, created_at: new Date().toISOString() }] : []);
  }
  return reply(config, method === 'get' ? 404 : 503, { detail: OFFLINE });
};

export function install() {
  api.defaults.adapter = adapter;
}
