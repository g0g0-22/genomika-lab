import { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import { useTheme } from './theme';
import { getConsent, setConsent, rememberPreference, CONSENT_CHANGED, type Consent } from './cookies';

/**
 * The visitor's current cookie choice, and a way to change it. Changing it
 * re-saves the current language and theme, so they move into cookies when
 * preferences are allowed and back into session storage when they are not.
 */
export function useCookieChoice() {
  const { lang } = useLang();
  const { theme } = useTheme();
  const [consent, setState] = useState<Consent | null>(getConsent);

  useEffect(() => {
    const sync = () => setState(getConsent());
    window.addEventListener(CONSENT_CHANGED, sync);
    return () => window.removeEventListener(CONSENT_CHANGED, sync);
  }, []);

  const choose = (choice: Consent) => {
    setConsent(choice);
    rememberPreference('genomika_lang', lang);
    rememberPreference('genomika_theme', theme);
  };

  return { consent, choose };
}
