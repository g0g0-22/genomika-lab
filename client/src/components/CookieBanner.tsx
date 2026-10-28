import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../i18n';
import { useCookieChoice } from '../lib/useCookieChoice';
import { OPEN_COOKIE_SETTINGS } from '../lib/cookies';

/**
 * Asks once, on the first visit, and again whenever the visitor opens
 * "Cookie settings" in the footer. Not shown on the Cookies page, which has
 * the same two choices beside the full list.
 */
export function CookieBanner() {
  const { t } = useLang();
  const { pathname } = useLocation();
  const { consent, choose } = useCookieChoice();
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }, []);

  if ((consent && !reopened) || pathname === '/cookies') return null;

  const pick = (choice: 'necessary' | 'preferences') => { choose(choice); setReopened(false); };

  return (
    <section
      aria-label={t('cookie.title')}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl card p-5 md:p-6 shadow-lg rise"
    >
      <p className="label">{t('cookie.title')}</p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">{t('cookie.banner')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => pick('preferences')}>{t('cookie.preferences')}</button>
        <button type="button" className="btn btn-sm" onClick={() => pick('necessary')}>{t('cookie.necessary')}</button>
        <Link to="/cookies" className="text-[13px] text-ink2 hover:text-ink link-underline ml-auto">{t('cookie.more')} →</Link>
      </div>
    </section>
  );
}
