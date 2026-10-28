/**
 * The site's cookies and the visitor's choice about them. Listed for visitors
 * on the Cookies page (pages/Cookies.tsx).
 *
 *   genomika_consent  necessary   the choice itself: 'necessary' | 'preferences'
 *   genomika_lang     preference  interface language
 *   genomika_theme    preference  light or dark theme
 *
 * Preference cookies are written only with consent. Without it, a language or
 * theme chosen now lasts until the browser closes (sessionStorage) and is
 * never sent to the server.
 */
export type Consent = 'necessary' | 'preferences';

const YEAR = 60 * 60 * 24 * 365;
export const CONSENT_CHANGED = 'genomika:consent';
export const OPEN_COOKIE_SETTINGS = 'genomika:cookie-settings';
const PREFERENCES = ['genomika_lang', 'genomika_theme'];

export function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, maxAge = YEAR) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function getConsent(): Consent | null {
  const value = readCookie('genomika_consent');
  return value === 'necessary' || value === 'preferences' ? value : null;
}

export function setConsent(consent: Consent) {
  writeCookie('genomika_consent', consent);
  if (consent === 'necessary') PREFERENCES.forEach(name => writeCookie(name, '', 0));
  window.dispatchEvent(new Event(CONSENT_CHANGED));
}

/** Keeps a preference: in a cookie with consent, otherwise for this session only. */
export function rememberPreference(name: string, value: string) {
  if (getConsent() === 'preferences') writeCookie(name, value);
  else try { sessionStorage.setItem(name, value); } catch { /* storage blocked */ }
}

export function recallPreference(name: string): string | null {
  try { return readCookie(name) ?? sessionStorage.getItem(name); } catch { return readCookie(name); }
}

// Earlier versions kept these two in localStorage; they now live as above.
try { localStorage.removeItem('genomika.lang'); localStorage.removeItem('genomika.theme'); } catch { /* storage blocked */ }
