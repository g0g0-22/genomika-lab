import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, post, getToken, setToken } from './api';

export type User = {
  id: number;
  email: string;
  role: 'admin' | 'researcher';
  person: { id: number; slug: string; name_mk: string; name_en: string; role_mk: string; role_en: string } | null;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api<{ user: User }>('/auth/me')
      .then(r => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const login = async (email: string, password: string) => {
    const r = await post<{ token: string; user: User }>('/auth/login', { email, password });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  };

  const logout = () => { setToken(null); setUser(null); };

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
