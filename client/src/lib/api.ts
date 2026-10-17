const BASE = '/api';
const TOKEN_KEY = 'genomika.token';

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode */ }
}

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  constructor(status: number, code: string, fields?: Record<string, string>) {
    super(code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, { ...init, headers });
  if (!res.ok) {
    let code = `http_${res.status}`;
    let fields: Record<string, string> | undefined;
    try {
      const body = await res.json();
      code = body.error || code;
      fields = body.fields;
    } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, code, fields);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const post = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

/**
 * Downloads a protected file. A plain <a href> cannot be used for these: the
 * browser follows a link without the Authorization header, so the server
 * sees an anonymous request and refuses it. The file is fetched with the
 * token instead and handed to the browser as a local object URL.
 */
export async function downloadProtected(path: string, fallbackName: string) {
  const token = getToken();
  const res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let code = `http_${res.status}`;
    try { code = (await res.json()).error || code; } catch { /* not JSON */ }
    throw new ApiError(res.status, code);
  }
  const disposition = res.headers.get('content-disposition') || '';
  const name = disposition.match(/filename="?([^";]+)"?/)?.[1] || fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
