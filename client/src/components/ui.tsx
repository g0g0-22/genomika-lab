import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n';

/* ----------------------------------------------------------- PRIMITIVES */

export function Label({ children, className = '', dot = false }: {
  children: ReactNode; className?: string; dot?: boolean;
}) {
  return <span className={`label ${dot ? 'label-dot' : ''} ${className}`}>{children}</span>;
}

export function Stat({ value, label, accent }: { value: ReactNode; label: string; accent?: string }) {
  return (
    <div>
      <div className="font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-none tracking-[-.03em]"
           style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="label mt-3">{label}</div>
    </div>
  );
}

/**
 * A row of nucleotide ticks, derived deterministically from a string. Kept
 * hairline-thin: it marks a section, it does not decorate it.
 */
export function DnaStrip({ seed = 'genomika', count = 48, className = '' }: {
  seed?: string; count?: number; className?: string;
}) {
  const bases = ['A', 'C', 'G', 'T'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const cells = Array.from({ length: count }, (_, i) => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    return bases[(hash >>> (i % 8)) % 4];
  });
  return (
    <div className={`flex gap-[3px] h-[3px] overflow-hidden ${className}`} aria-hidden="true">
      {cells.map((b, i) => (
        <span key={i} className={`flex-1 nt-${b}`} style={{ background: 'currentColor', opacity: 0.4 }} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- HEADERS */

/**
 * Page masthead. The index numeral sits in the left margin and the lead sits
 * in its own column, the way a printed report sets an opening spread.
 */
export function PageHeader({ index, title, lead, children }: {
  index: string; title: string; lead?: string; children?: ReactNode;
}) {
  const folio = index.split('/')[0].trim();
  return (
    <header className="mb-20 md:mb-28">
      <div className="grid gap-y-8 md:grid-cols-12 md:gap-x-10 items-end">
        <div className="md:col-span-8">
          <span className="folio block rise text-muted">{folio}</span>
          <h1 className="mt-5 text-[clamp(2.4rem,6.5vw,5.1rem)] rise" style={{ animationDelay: '60ms' }}>
            {title}
          </h1>
        </div>
        {lead && (
          <div className="md:col-span-4 md:pb-3">
            <p className="text-[14px] leading-[1.65] text-ink2 rise" style={{ animationDelay: '130ms' }}>
              {lead}
            </p>
          </div>
        )}
      </div>
      {children && (
        <div className="mt-12 pt-7 border-t border-line rise" style={{ animationDelay: '190ms' }}>
          {children}
        </div>
      )}
    </header>
  );
}

export function SectionHeading({ index, title, sub, right }: {
  index?: string; title: string; sub?: string; right?: ReactNode;
}) {
  return (
    <div className="pt-7 border-t border-line mb-10">
      <div className="grid gap-y-5 md:grid-cols-12 md:gap-x-10 items-start">
        {index && <span className="folio text-muted md:col-span-1">{index}</span>}
        <div className={index ? 'md:col-span-6' : 'md:col-span-7'}>
          <h2 className="text-[clamp(1.5rem,2.6vw,2.2rem)]">{title}</h2>
        </div>
        <div className="md:col-span-4 md:col-start-9 flex items-start justify-between gap-5">
          {sub && <p className="text-[13.5px] leading-relaxed text-ink2 max-w-sm">{sub}</p>}
          {right && <div className="shrink-0 ml-auto">{right}</div>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- SURFACES */

export function Card({ children, className = '', hover = false, as: As = 'div', style }: {
  children: ReactNode; className?: string; hover?: boolean; as?: any; style?: CSSProperties;
}) {
  return <As className={`card ${hover ? 'card-hover' : ''} ${className}`} style={style}>{children}</As>;
}

/* ------------------------------------------------------------- FEEDBACK */

export function Loading({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <div className="flex items-center gap-3 py-20 text-muted fade" role="status" aria-live="polite">
      <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-ink" />
      <span className="label">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorBox({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <div className="card p-7 my-10" role="alert">
      <p className="text-[14px] text-danger">{t('common.error')}</p>
      {onRetry && <button className="btn btn-sm mt-5" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

export function Empty({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <div className="py-20 text-center border-t border-line">
      <p className="label">{label ?? t('common.empty')}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- FORMS */

export function Field({ label, hint, error, children, required }: {
  label: string; hint?: string; error?: string; children: ReactNode; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label block mb-2.5">
        {label}
        {required && <span className="ml-1">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block mt-2 text-[11.5px] text-muted">{hint}</span>}
      {error && <span className="block mt-2 text-[11.5px] text-danger">{error}</span>}
    </label>
  );
}

export function Toggle({ options, value, onChange, ariaLabel }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="inline-flex gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`chip ${value === o.value ? 'chip-on' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'error'; children: ReactNode }) {
  const tone = kind === 'error' ? 'text-danger' : kind === 'ok' ? 'text-accent' : 'text-ink2';
  return (
    <div className={`border-l-2 pl-5 py-1 text-[14px] ${tone}`}
         style={{ borderColor: kind === 'error' ? 'var(--danger)' : kind === 'ok' ? 'var(--accent)' : 'var(--line-firm)' }}
         role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- NAVIGATION */

export function ArrowLink({ to, children, external = false }: { to: string; children: ReactNode; external?: boolean }) {
  const inner = (
    <>
      <span className="link-underline">{children}</span>
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 inline-block">→</span>
    </>
  );
  const cls = 'group inline-flex items-center gap-2 text-[13px] text-ink hover:text-accent transition-colors';
  return external
    ? <a className={cls} href={to} target="_blank" rel="noopener noreferrer">{inner}</a>
    : <Link className={cls} to={to}>{inner}</Link>;
}

export function Crumb({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="label hover:text-ink inline-flex items-center gap-2 transition-colors">
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}

/* ---------------------------------------------------------------- UTILS */

/**
 * Maps a group's accent key onto its categorical series colour. 'amber' is the
 * key stored by older seeds; the colour it names is now a rose, chosen because
 * green and amber were indistinguishable under simulated protanopia.
 */
export const accentVar = (accent?: string) =>
  accent === 'blue' ? 'var(--s-blue)'
    : accent === 'amber' || accent === 'rose' ? 'var(--s-rose)'
    : 'var(--s-green)';

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useLang();
  return (
    <button
      className="btn btn-sm"
      onClick={async (e) => {
        try {
          await navigator.clipboard.writeText(text);
          const el = e.currentTarget;
          const original = el.textContent;
          el.textContent = t('common.copied');
          setTimeout(() => { el.textContent = original; }, 1400);
        } catch { /* clipboard unavailable */ }
      }}
    >
      {label ?? t('common.copy')}
    </button>
  );
}

/** Triggers a client-side file download from a string. */
export function download(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
