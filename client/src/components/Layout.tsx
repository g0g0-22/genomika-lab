import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useLang } from '../i18n';
import { useTheme } from '../lib/theme';
import { useAuth } from '../lib/auth';

/* ------------------------------------------------------------ BRAND MARK */

function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M10 3c0 6.5 12 8.5 12 13S10 22.5 10 29" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M22 3c0 6.5-12 8.5-12 13s12 6.5 12 13" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".35" />
    </svg>
  );
}

/* --------------------------------------------------------------- ROUTES */

const PRIMARY = [
  { to: '/research', key: 'nav.research' },
  { to: '/team', key: 'nav.team' },
  { to: '/publications', key: 'nav.publications' },
  { to: '/tools', key: 'nav.tools' },
  { to: '/datasets', key: 'nav.datasets' },
  { to: '/facilities', key: 'nav.facilities' }
] as const;

const SECONDARY = [
  { to: '/events', key: 'nav.events' },
  { to: '/news', key: 'nav.news' },
  { to: '/metrics', key: 'nav.metrics' },
  { to: '/careers', key: 'nav.careers' }
] as const;

/* ------------------------------------------------------------- CONTROLS */

function LangSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('foot.lang')}>
      {(['mk', 'en'] as const).map((code, i) => (
        <span key={code} className="flex items-center">
          {i === 1 && <span className="text-muted mx-1 select-none" aria-hidden="true">/</span>}
          <button
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
            lang={code}
            className={`text-[11.5px] font-medium uppercase tracking-[.06em] transition-colors ${
              lang === code ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {code}
          </button>
        </span>
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
      className="text-muted hover:text-ink transition-colors p-1"
      aria-label={`${t('foot.theme')}: ${t(theme === 'dark' ? 'theme.dark' : 'theme.light')}`}
      title={t('foot.theme')}
    >
      {theme === 'dark' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ NAV */

function Nav() {
  const { t } = useLang();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  /*
   * The open menu covers the whole page, so it has to behave like a dialog:
   * focus moves into it, Tab stays inside it, Escape closes it, and focus
   * returns to the button that opened it. Without this a keyboard or
   * screen-reader user is left on controls hidden behind the overlay.
   */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return () => { document.body.style.overflow = ''; };

    const panel = panelRef.current;
    const focusable = () => [...(panel?.querySelectorAll<HTMLElement>('a, button') ?? [])];
    focusable()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const link = ({ isActive }: { isActive: boolean }) =>
    `text-[13.5px] transition-colors ${isActive ? 'text-ink' : 'text-ink2 hover:text-ink'}`;

  return (
    <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur-sm border-b border-line">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10">
        <div className="flex items-center h-16 gap-8">

          <Link to="/" className="flex items-center gap-2.5 shrink-0 text-ink">
            <Mark />
            <span className="font-display font-semibold text-[15px] tracking-[-.02em] leading-none">
              {t('brand.name')}
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-7 mx-auto" aria-label={t('nav.primary')}>
            {PRIMARY.map(item => (
              <NavLink key={item.to} to={item.to} className={link}>{t(item.key)}</NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-5 ml-auto lg:ml-0 shrink-0">
            <div className="hidden sm:flex items-center gap-4">
              <LangSwitch />
              <ThemeSwitch />
            </div>
            {/* The mobile menu lists this too; without it here a desktop admin had no way in. */}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className={state => `hidden lg:inline ${link(state)}`}>{t('nav.admin')}</NavLink>
            )}
            <Link to="/contact" className="btn btn-primary btn-sm hidden md:inline-flex">
              {t('nav.contact')}
              <span aria-hidden="true">→</span>
            </Link>
            <button
              ref={toggleRef}
              className="lg:hidden text-ink p-1 -mr-1"
              onClick={() => setOpen(o => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={t('nav.menu')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                {open ? <path d="M5 5l14 14M19 5L5 19" strokeLinecap="round" />
                      : <path d="M3 8h18M3 16h18" strokeLinecap="round" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Full-height panel on small screens — the complete index, not a stub. */}
      {open && (
        <div
          ref={panelRef}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.menu')}
          className="lg:hidden fixed inset-x-0 top-16 bottom-0 bg-bg border-t border-line overflow-y-auto fade"
        >
          <nav className="px-6 py-10" aria-label={t('nav.menu')}>
            <ul className="space-y-5">
              {PRIMARY.map(item => (
                <li key={item.to}>
                  <NavLink to={item.to} className="font-display text-2xl text-ink">{t(item.key)}</NavLink>
                </li>
              ))}
            </ul>
            <ul className="mt-10 pt-8 border-t border-line space-y-4">
              {SECONDARY.map(item => (
                <li key={item.to}>
                  <NavLink to={item.to} className="text-[15px] text-ink2">{t(item.key)}</NavLink>
                </li>
              ))}
              {user?.role === 'admin' && (
                <li><NavLink to="/admin" className="text-[15px] text-ink2">{t('nav.admin')}</NavLink></li>
              )}
              <li>
                {user
                  ? <button onClick={logout} className="text-[15px] text-ink2">{t('nav.logout')}</button>
                  : <NavLink to="/login" className="text-[15px] text-ink2">{t('nav.login')}</NavLink>}
              </li>
            </ul>
            <div className="mt-10 pt-8 border-t border-line flex items-center gap-6">
              <LangSwitch />
              <ThemeSwitch />
              <Link to="/contact" className="btn btn-primary btn-sm ml-auto">{t('nav.contact')} →</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* --------------------------------------------------------------- FOOTER */

function Footer() {
  const { t } = useLang();
  const { user, logout } = useAuth();

  return (
    <footer className="mt-32 border-t border-line bg-ground">
      <div className="mx-auto max-w-[1280px] px-6 md:px-10 py-20">
        <div className="grid gap-12 md:grid-cols-12">

          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5 text-ink">
              <Mark size={18} />
              <span className="font-display font-semibold text-[15px] tracking-[-.02em]">{t('brand.name')}</span>
            </div>
            <p className="mt-6 max-w-sm text-[13.5px] leading-relaxed text-ink2">{t('home.disclaimer.b')}</p>
            <p className="mt-6 label">{t('foot.builtwith')}</p>
          </div>

          <div className="md:col-span-3 md:col-start-7">
            <h2 className="label mb-5">{t('foot.explore')}</h2>
            <ul className="space-y-2.5">
              {PRIMARY.map(item => (
                <li key={item.to}>
                  <Link to={item.to} className="text-[14px] text-ink2 hover:text-ink link-underline">{t(item.key)}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="label mb-5">{t('foot.about')}</h2>
            <ul className="space-y-2.5">
              {[...SECONDARY, { to: '/contact', key: 'nav.contact' as const }].map(item => (
                <li key={item.to}>
                  <Link to={item.to} className="text-[14px] text-ink2 hover:text-ink link-underline">{t(item.key)}</Link>
                </li>
              ))}
              {user?.role === 'admin' && (
                <li><Link to="/admin" className="text-[14px] text-ink2 hover:text-ink link-underline">{t('nav.admin')}</Link></li>
              )}
              <li>
                {user
                  ? <button type="button" onClick={logout} className="text-[14px] text-ink2 hover:text-ink link-underline">{t('nav.logout')}</button>
                  : <Link to="/login" className="text-[14px] text-ink2 hover:text-ink link-underline">{t('nav.login')}</Link>}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-20 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-5">
          <span className="label">© {new Date().getFullYear()} {t('brand.name')} — {t('foot.rights')}</span>
          <span className="label">{t('brand.city')}</span>
        </div>
      </div>
    </footer>
  );
}

/* -------------------------------------------------------- SESSION ENDED */

function SessionEnded() {
  const { t } = useLang();
  const { expired, dismissExpired } = useAuth();
  if (!expired) return null;
  return (
    <div className="mb-10 card p-4 flex flex-wrap items-center gap-4" role="alert">
      <p className="text-[13.5px] flex-1 min-w-[200px]">{t('auth.expired')}</p>
      <Link to="/login" className="btn btn-sm btn-primary" onClick={dismissExpired}>{t('nav.login')} →</Link>
      <button type="button" className="btn btn-sm" onClick={dismissExpired}>{t('common.close')}</button>
    </div>
  );
}

/* --------------------------------------------------------------- LAYOUT */

export default function Layout() {
  const { t } = useLang();
  const { pathname } = useLocation();

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="skip-link">{t('nav.skip')}</a>
      <Nav />
      <main id="main" className="flex-1 mx-auto w-full max-w-[1280px] px-6 md:px-10 py-16 md:py-24">
        <SessionEnded />
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
