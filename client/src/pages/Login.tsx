import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useLang } from '../i18n';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useFetch } from '../lib/useFetch';
import { PageHeader, Card, Label, Field, Notice } from '../components/ui';

/** Demo logins the deployment chooses to advertise (DEMO_LOGINS on the api); often none. */
type DemoLogin = { role: 'admin' | 'researcher'; email: string; password: string };

/** Where each role lands after signing in: administrators have the admin panel to go to. */
const home = (role: string) => (role === 'admin' ? '/admin' : '/facilities');

export default function Login() {
  const { t } = useLang();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Which message to show: a wrong credential, or too many attempts from here.
  const [error, setError] = useState<'invalid' | 'throttled' | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = useFetch<{ accounts: DemoLogin[] }>('/auth/demo');
  const accounts = demo.data?.accounts ?? [];

  if (user) return <Navigate to={home(user.role)} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signedIn = await login(email, password);
      navigate(home(signedIn.role));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'throttled' : 'invalid');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader index="11 / AUTH" title={t('auth.title')} lead={t('auth.lead')} />

      <div className="grid gap-8 md:grid-cols-2 max-w-4xl">
        <Card className="p-6 md:p-8">
          <form onSubmit={submit} className="space-y-5">
            <Field label={t('common.email')} required>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
            </Field>
            <Field label={t('auth.password')} required>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </Field>
            {error && <Notice kind="error">{t(error === 'throttled' ? 'auth.throttled' : 'auth.invalid')}</Notice>}
            <button className="btn btn-primary w-full justify-center" disabled={busy}>{t('auth.submit')} →</button>
          </form>
        </Card>

        {accounts.length > 0 && <Card className="p-6 md:p-8">
          <Label>{t('auth.demo')}</Label>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {t('home.disclaimer.b').split('.')[0]}.
          </p>
          <ul className="mt-5 space-y-3">
            {accounts.map(account => (
              <li key={account.email} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="label">{t(account.role === 'admin' ? 'auth.demoadmin' : 'auth.demoresearch')}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => { setEmail(account.email); setPassword(account.password); }}
                  >
                    {t('auth.demofill')}
                  </button>
                </div>
                <p className="num text-[12px] mt-2.5 text-ink2 break-all">{account.email}</p>
                <p className="num text-[12px] text-muted">{account.password}</p>
              </li>
            ))}
          </ul>
        </Card>}
      </div>
    </>
  );
}
