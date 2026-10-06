import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLang } from '../i18n';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { DnaStrip } from './ui';

/* ------------------------------------------------------------ BRAND MARK */

function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M10 3c0 6.5 12 8.5 12 13S10 22.5 10 29" stroke="var(--accent)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M22 3c0 6.5-12 8.5-12 13s12 6.5 12 13" stroke="var(--s-blue)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.7" fill="var(--ink)" />
    </svg>
  );
}

/* -------------------------------------------------------------- CONTROLS */

function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="flex items-center border border-line rounded-xs overflow-hidden" role="group" aria-label={t('foot.lang')}>
      {(['mk', 'en'] as const).map(code => (
        <button
          key={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          lang={code}
          className={`px-2 py-1 font-mono text-[10px] uppercase tracking-[.12em] transition-colors ${
            lang === code ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-ink'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

function ThemeSwitch() {
  const { theme, toggle } = useTheme();
  const { t } = useLang();
  return (
    <button
      onClick={toggle}
      className="p-1.5 border border-line rounded-xs text-muted hover:text-accent hover:border-accent transition-colors"
      aria-label={`${t('foot.theme')}: ${theme}`}
      title={t('foot.theme')}
    >
      {theme === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------- NAV */

const PRIMARY = [
  { to: '/research', key: 'nav.research' },
  { to: '/team', key: 'nav.team' },
  { to: '/publications', key: 'nav.publications' },
  { to: '/datasets', key: 'nav.datasets' },
  { to: '/tools', key: 'nav.tools' },
  { to: '/facilities', key: 'nav.facilities' }
] as const;

const SECONDARY = [
  { to: '/events', key: 'nav.events' },
  { to: '/news', key: 'nav.news' },
  { to: '/metrics', key: 'nav.metrics' },
  { to: '/careers', key: 'nav.careers' },
  { to: '/contact', key: 'nav.contact' }
] as const;

function Nav() {
  const { t } = useLang();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `font-mono text-[11px] uppercase tracking-[.11em] transition-colors ${
      isActive ? 'text-accent' : 'text-ink2 hover:text-accent'
    }`;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-bg/85 border-b border-line">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8">
        <div className="flex items-center gap-6 h-[62px]">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <Mark />
            <span className="hidden sm:block">
              <span className="block font-display font-semibold text-[15px] leading-none tracking-tight">{t('brand.name')}</span>
              <span className="block label mt-1 leading-none group-hover:text-accent transition-colors">
                {t('brand.tagline')}
              </span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-5 ml-auto" aria-label="primary">
            {PRIMARY.map(item => (
              <NavLink key={item.to} to={item.to} className={linkClass}>{t(item.key)}</NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto lg:ml-0">
            <LangSwitch />
            <ThemeSwitch />
            {user ? (
              <button onClick={logout} className="btn btn-sm hidden md:inline-flex">{t('nav.logout')}</button>
            ) : (
              <Link to="/login" className="btn btn-sm hidden md:inline-flex">{t('nav.login')}</Link>
            )}
            <button
              className="lg:hidden p-2 border border-line rounded-xs text-ink2"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-label={t('nav.menu')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {open
                  ? <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
                  : <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Secondary row: visible on wide screens, folded into the drawer below. */}
        <div className="hidden lg:flex items-center gap-5 h-9 border-t border-linesoft">
          {SECONDARY.map(item => (
            <NavLink key={item.to} to={item.to} className={linkClass}>{t(item.key)}</NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={linkClass}>{t('nav.admin')}</NavLink>
          )}
          <span className="ml-auto label flex items-center gap-2">
            <span className="live-dot w-1.5 h-1.5 rounded-full bg-accent inline-block" />
            {t('brand.city')}
          </span>
        </div>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-line bg-bg2 px-5 py-5 rise" aria-label="mobile">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3.5">
            {[...PRIMARY, ...SECONDARY].map(item => (
              <li key={item.to}><NavLink to={item.to} className={linkClass}>{t(item.key)}</NavLink></li>
            ))}
            {user?.role === 'admin' && <li><NavLink to="/admin" className={linkClass}>{t('nav.admin')}</NavLink></li>}
            <li>
              {user
                ? <button onClick={logout} className={linkClass({ isActive: false })}>{t('nav.logout')}</button>
                : <NavLink to="/login" className={linkClass}>{t('nav.login')}</NavLink>}
            </li>
          </ul>
        </nav>
      )}
      <DnaStrip seed="genomika-nav" count={120} className="opacity-40" />
    </header>
  );
}

/* ---------------------------------------------------------------- FOOTER */

function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto max-w-[1240px] px-5 md:px-8 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <Mark size={22} />
              <span className="font-display font-semibold text-[15px]">{t('brand.name')}</span>
            </div>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted">{t('home.disclaimer.b')}</p>
            <p className="mt-4 label">{t('foot.builtwith')}</p>
          </div>

          <div>
            <h2 className="label mb-3">{t('foot.explore')}</h2>
            <ul className="space-y-2">
              {PRIMARY.map(item => (
                <li key={item.to}>
                  <Link to={item.to} className="text-[13px] text-ink2 hover:text-accent link-underline">{t(item.key)}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="label mb-3">{t('foot.about')}</h2>
            <ul className="space-y-2">
              {SECONDARY.map(item => (
                <li key={item.to}>
                  <Link to={item.to} className="text-[13px] text-ink2 hover:text-accent link-underline">{t(item.key)}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-linesoft flex flex-wrap items-center justify-between gap-4">
          <span className="label">© {new Date().getFullYear()} {t('brand.name')} — {t('foot.rights')}</span>
          <div className="flex items-center gap-3">
            <LangSwitch />
            <ThemeSwitch />
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- LAYOUT */

export default function Layout() {
  const { t } = useLang();
  const { pathname } = useLocation();

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="skip-link">{t('nav.skip')}</a>
      <Nav />
      <main id="main" className="flex-1 mx-auto w-full max-w-[1240px] px-5 md:px-8 py-12 md:py-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
