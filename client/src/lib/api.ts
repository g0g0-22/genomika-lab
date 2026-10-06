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
