import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, post, getToken, setToken, SESSION_ENDED } from './api';

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
  /** The server stopped accepting the session; the user has not signed out themselves. */
  expired: boolean;
  dismissExpired: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  // Read by the listener below, which is registered once.
  const signedIn = useRef(false);
  useEffect(() => { signedIn.current = user !== null; }, [user]);

  useEffect(() => {
    const ended = () => {
      if (signedIn.current) setExpired(true);
      setUser(null);
    };
    window.addEventListener(SESSION_ENDED, ended);
    return () => window.removeEventListener(SESSION_ENDED, ended);
  }, []);

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
    setExpired(false);
    return r.user;
  };

  const logout = () => { setToken(null); setUser(null); };
  const dismissExpired = () => setExpired(false);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, expired, dismissExpired }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
