import { useRef, type ChangeEvent } from 'react';
import { useLang } from '../i18n';
import { Label } from './ui';

/**
 * Shared input for every tool: a textarea, a file picker for FASTA files, and
 * a one-click example. The example button matters — a visitor who has to find
 * a sequence before the tool does anything usually never sees it work.
 */
export function SequenceInput({ value, onChange, onExample, label, placeholder, rows = 6, extra, dropped, ambiguous, records, firstId, protein }: {
  value: string;
  onChange: (v: string) => void;
  onExample?: () => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  extra?: React.ReactNode;
  dropped?: number;
  /** Ambiguity codes that were read as N. */
  ambiguous?: number;
  /** How many FASTA records the input holds; only the first is analysed. */
  records?: number;
  firstId?: string;
  /** The input reads as a protein, which nucleotide tools cannot analyse. */
  protein?: boolean;
}) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? '').slice(0, 2_000_000));
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <Label>{label ?? t('seq.input')}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}
                  aria-label={t('seq.loadfile')} title={t('seq.loadfile')}>FASTA…</button>
          {onExample && <button type="button" className="btn btn-sm" onClick={onExample}>{t('common.example')}</button>}
          {value && <button type="button" className="btn btn-sm" onClick={() => onChange('')}>{t('common.clear')}</button>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".fa,.fasta,.fna,.faa,.txt,.seq"
        onChange={readFile}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />
      <textarea
        className="input font-mono text-[12.5px] leading-relaxed"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? t('seq.inputph')}
        aria-label={label ?? t('seq.input')}
        spellCheck={false}
      />
      {protein ? (
        <p className="mt-2 text-[12px] text-srose" role="status">{t('seq.isprotein')}</p>
      ) : null}
      {!protein && dropped ? (
        <p className="mt-1.5 text-[12px] text-srose" role="status">{t('seq.invalid').replace('{n}', String(dropped))}</p>
      ) : null}
      {!protein && ambiguous ? (
        <p className="mt-1.5 text-[12px] text-muted" role="status">{t('seq.ambiguous').replace('{n}', String(ambiguous))}</p>
      ) : null}
      {records && records > 1 ? (
        <p className="mt-1.5 text-[11.5px] text-muted" role="status">
          {t('seq.multirecord').replace('{n}', String(records)).replace('{id}', firstId ?? '')}
        </p>
      ) : null}
    </div>
  );
}
