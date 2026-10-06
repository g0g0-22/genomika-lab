import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n';

/* ------------------------------------------------------------ PRIMITIVES */

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`label ${className}`}>{children}</span>;
}

export function Stat({ value, label, accent }: { value: ReactNode; label: string; accent?: string }) {
  return (
    <div>
      <div className="num text-3xl md:text-4xl leading-none" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="label mt-2">{label}</div>
    </div>
  );
}

/**
 * The decorative nucleotide strip. It is derived from a string so the same
 * heading always produces the same pattern — a small deterministic signature.
 */
export function DnaStrip({ seed = 'genomika', count = 48, className = '' }: { seed?: string; count?: number; className?: string }) {
  const bases = ['A', 'C', 'G', 'T'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const cells = Array.from({ length: count }, (_, i) => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    return bases[(hash >>> (i % 8)) % 4];
  });
  return (
    <div className={`flex gap-[2px] h-1.5 overflow-hidden ${className}`} aria-hidden="true">
      {cells.map((b, i) => (
        <span key={i} className={`flex-1 nt-${b}`} style={{ background: 'currentColor', opacity: 0.55 }} />
      ))}
    </div>
  );
}

export function PageHeader({ index, title, lead, children }: { index: string; title: string; lead?: string; children?: ReactNode }) {
  return (
    <header className="border-b border-line pb-10 mb-12">
      <div className="flex items-baseline gap-4 rise">
        <span className="num text-accent text-xs">{index}</span>
        <DnaStrip seed={title} count={28} className="w-24 opacity-60" />
      </div>
      <h1 className="mt-5 text-4xl md:text-6xl rise" style={{ animationDelay: '60ms' }}>{title}</h1>
      {lead && (
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink2 rise" style={{ animationDelay: '120ms' }}>
          {lead}
        </p>
      )}
      {children && <div className="mt-7 rise" style={{ animationDelay: '180ms' }}>{children}</div>}
    </header>
  );
}

export function SectionHeading({ index, title, sub, right }: { index?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3">
          {index && <span className="num text-[11px] text-accent">{index}</span>}
          <h2 className="text-2xl md:text-[28px]">{title}</h2>
        </div>
        {sub && <p className="mt-2 text-sm text-muted max-w-xl">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ children, className = '', hover = false, as: As = 'div', style }: {
  children: ReactNode; className?: string; hover?: boolean; as?: any; style?: CSSProperties;
}) {
  return <As className={`card ${hover ? 'card-hover' : ''} ${className}`} style={style}>{children}</As>;
}

/* ------------------------------------------------------------ FEEDBACK -- */

export function Loading({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <div className="flex items-center gap-3 py-16 text-muted fade" role="status" aria-live="polite">
      <span className="live-dot inline-block w-2 h-2 rounded-full bg-accent" />
      <span className="label">{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorBox({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <div className="card p-6 my-8 border-danger/40" role="alert">
      <p className="text-sm text-danger">{t('common.error')}</p>
      {onRetry && <button className="btn btn-sm mt-4" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

export function Empty({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <div className="py-14 text-center">
      <DnaStrip seed="empty" count={16} className="w-24 mx-auto opacity-30" />
      <p className="label mt-4">{label ?? t('common.empty')}</p>
    </div>
  );
}

/* --------------------------------------------------------------- FORMS -- */

export function Field({ label, hint, error, children, required }: {
  label: string; hint?: string; error?: string; children: ReactNode; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label block mb-2">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block mt-1.5 text-[11px] text-muted">{hint}</span>}
      {error && <span className="block mt-1.5 text-[11px] text-danger">{error}</span>}
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
    <div className="inline-flex border border-line rounded-xs overflow-hidden" role="group" aria-label={ariaLabel}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.1em] transition-colors ${
            value === o.value ? 'bg-accent text-bg font-semibold' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'error'; children: ReactNode }) {
  const border = kind === 'error' ? 'border-danger/50' : kind === 'ok' ? 'border-accent/50' : 'border-line';
  const text = kind === 'error' ? 'text-danger' : kind === 'ok' ? 'text-accent' : 'text-ink2';
  return (
    <div className={`card ${border} p-4 text-sm ${text}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------- NAVIGATION -- */

export function ArrowLink({ to, children, external = false }: { to: string; children: ReactNode; external?: boolean }) {
  const inner = (
    <>
      <span className="link-underline">{children}</span>
      <span aria-hidden="true" className="transition-transform group-hover:translate-x-1 inline-block">→</span>
    </>
  );
  const cls = 'group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.1em] text-accent';
  return external
    ? <a className={cls} href={to} target="_blank" rel="noopener noreferrer">{inner}</a>
    : <Link className={cls} to={to}>{inner}</Link>;
}

export function Crumb({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="label hover:text-accent inline-flex items-center gap-2">
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}

/* ------------------------------------------------------------- HELPERS -- */

/** Maps a group's accent key onto its validated categorical series colour. */
export const accentVar = (accent?: string) =>
  accent === 'blue' ? 'var(--s-blue)' : accent === 'amber' ? 'var(--s-amber)' : 'var(--s-green)';

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
