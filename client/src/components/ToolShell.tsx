import type { ReactNode } from 'react';
import { useLang } from '../i18n';
import { Crumb } from './ui';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import type { DictKey } from '../i18n/dict';

export function ToolShell({ index, name, desc, children }: {
  index: string; name: DictKey; desc: DictKey; children: ReactNode;
}) {
  const { t } = useLang();
  useDocumentTitle(t(name));
  return (
    <>
      <div className="mb-8">
        <Crumb to="/tools" label={t('tools.title')} />
      </div>
      <header className="mb-14 md:mb-20">
        <div className="grid gap-y-7 md:grid-cols-12 md:gap-x-10 items-end">
          <div className="md:col-span-8">
            <span className="folio block text-muted">{index.split('/')[0].trim()}</span>
            <h1 className="mt-5 text-[clamp(2rem,5vw,3.6rem)]">{t(name)}</h1>
          </div>
          <div className="md:col-span-4 md:pb-2">
            <p className="text-[13.5px] leading-[1.65] text-ink2">{t(desc)}</p>
            <span className="label label-dot block mt-5">{t('tools.local')}</span>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}

export function Panel({ title, right, children, className = '' }: {
  title?: string; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`card p-6 md:p-7 ${className}`}>
      {(title || right) && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {title && <h2 className="label">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Metric({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="min-w-0">
      <div className="label truncate">{label}</div>
      <div className="num text-lg mt-1 truncate">
        {value}{unit && <span className="text-muted text-xs ml-1">{unit}</span>}
      </div>
    </div>
  );
}
