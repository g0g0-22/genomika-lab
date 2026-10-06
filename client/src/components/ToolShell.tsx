import type { ReactNode } from 'react';
import { useLang } from '../i18n';
import { Crumb, DnaStrip } from './ui';
import type { DictKey } from '../i18n/dict';

export function ToolShell({ index, name, desc, children }: {
  index: string; name: DictKey; desc: DictKey; children: ReactNode;
}) {
  const { t } = useLang();
  return (
    <>
      <div className="mb-8">
        <Crumb to="/tools" label={t('tools.title')} />
      </div>
      <header className="border-b border-line pb-8 mb-10">
        <div className="flex items-baseline gap-4">
          <span className="num text-accent text-xs">{index}</span>
          <DnaStrip seed={name} count={24} className="w-20 opacity-60" />
          <span className="chip chip-on ml-auto">{t('tools.local')}</span>
        </div>
        <h1 className="mt-4 text-3xl md:text-5xl">{t(name)}</h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink2">{t(desc)}</p>
      </header>
      {children}
    </>
  );
}

export function Panel({ title, right, children, className = '' }: {
  title?: string; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`card p-5 md:p-6 ${className}`}>
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
