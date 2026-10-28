import { useLang } from '../i18n';
import { PageHeader, Card, Notice } from '../components/ui';
import { useCookieChoice } from '../lib/useCookieChoice';
import type { DictKey } from '../i18n/dict';

/** Everything the site keeps in the browser — the three cookies and the one local-storage entry. */
const STORED: { name: string; purpose: DictKey; kind: DictKey; duration: DictKey }[] = [
  { name: 'genomika_consent', purpose: 'cookie.p.consent', kind: 'cookie.kind.necessary', duration: 'cookie.d.year' },
  { name: 'genomika_lang', purpose: 'cookie.p.lang', kind: 'cookie.kind.preference', duration: 'cookie.d.year' },
  { name: 'genomika_theme', purpose: 'cookie.p.theme', kind: 'cookie.kind.preference', duration: 'cookie.d.year' },
  { name: 'genomika.token', purpose: 'cookie.p.token', kind: 'cookie.kind.storage', duration: 'cookie.d.session' }
];

export default function Cookies() {
  const { t } = useLang();
  const { consent, choose } = useCookieChoice();

  return (
    <>
      <PageHeader index="14 / COOKIES" title={t('cookie.title')} lead={t('cookie.lead')} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <Card className="p-6 overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left">
                {(['cookie.col.name', 'cookie.col.purpose', 'cookie.col.kind', 'cookie.col.duration'] as const).map(key => (
                  <th key={key} scope="col" className="label pb-3 pr-4 font-medium">{t(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STORED.map(row => (
                <tr key={row.name} className="border-t border-linesoft align-top">
                  <td className="py-3 pr-4 num text-[12.5px] whitespace-nowrap">{row.name}</td>
                  <td className="py-3 pr-4 text-ink2">{t(row.purpose)}</td>
                  <td className="py-3 pr-4 text-ink2 whitespace-nowrap">{t(row.kind)}</td>
                  <td className="py-3 text-ink2 whitespace-nowrap">{t(row.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 text-[13px] leading-relaxed text-muted">{t('cookie.none')}</p>
        </Card>

        <Card className="p-6">
          <h2 className="label mb-3">{t('cookie.current')}</h2>
          <p className="text-[14px]">
            {consent === 'preferences' ? t('cookie.preferences') : consent === 'necessary' ? t('cookie.necessary') : t('cookie.unset')}
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{t('cookie.withoutnote')}</p>
          <div className="mt-5 grid gap-2">
            <button type="button" className={`btn btn-sm justify-center ${consent === 'preferences' ? 'btn-primary' : ''}`}
                    aria-pressed={consent === 'preferences'} onClick={() => choose('preferences')}>{t('cookie.preferences')}</button>
            <button type="button" className={`btn btn-sm justify-center ${consent === 'necessary' ? 'btn-primary' : ''}`}
                    aria-pressed={consent === 'necessary'} onClick={() => choose('necessary')}>{t('cookie.necessary')}</button>
          </div>
          {consent && <div className="mt-4"><Notice kind="ok">{t('cookie.saved')}</Notice></div>}
        </Card>
      </div>
    </>
  );
}
