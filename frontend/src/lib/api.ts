import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // An expired session: forget it and go back to the cover page. A failed
    // sign-in (also 401) is left to the form to explain.
    const url: string = err.config?.url ?? '';
    if (err.response?.status === 401 && !url.startsWith('/auth/') && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;

/** A readable message from a failed API call. FastAPI sends `detail` as a
 * string, or as a list of field errors when validation fails. */
export function errorMessage(err: unknown, fallback: string): string {
  const res = (err as { response?: { data?: { detail?: unknown } } })?.response;
  const detail = res?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((d: { loc?: string[]; msg?: string }) => {
        const field = d.loc?.[d.loc.length - 1];
        const msg = (d.msg || '').replace(/^Value error, /, '');
        return field && field !== 'body' ? `${field.replace(/_/g, ' ')}: ${msg}` : msg;
      })
      .join('; ');
  }
  if (!res) return `${fallback}: can't reach the server. Check your connection and try again.`;
  return fallback;
}
