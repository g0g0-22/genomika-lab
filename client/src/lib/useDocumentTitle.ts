import { useEffect } from 'react';
import { useLang } from '../i18n';

/**
 * Sets the browser tab title for the current page, in the current language.
 * Without it every page carried the same title, so tabs, history entries and
 * screen readers could not tell one page from another. Called with nothing,
 * it restores the site's own title.
 */
export function useDocumentTitle(title?: string | null) {
  const { t } = useLang();
  const site = `GenomikaLab — ${t('meta.title')}`;
  useEffect(() => {
    document.title = title ? `${title} · GenomikaLab` : site;
  }, [title, site]);
}
