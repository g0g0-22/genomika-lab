import { useRef, type ChangeEvent } from 'react';
import { useLang } from '../i18n';
import { Label } from './ui';

/**
 * Shared input for every tool: a textarea, a file picker for FASTA files, and
 * a one-click example. The example button matters — a visitor who has to find
 * a sequence before the tool does anything usually never sees it work.
 */
export function SequenceInput({ value, onChange, onExample, label, placeholder, rows = 6, extra, dropped }: {
  value: string;
  onChange: (v: string) => void;
  onExample?: () => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  extra?: React.ReactNode;
  dropped?: number;
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
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>FASTA…</button>
          {onExample && <button className="btn btn-sm" onClick={onExample}>{t('common.example')}</button>}
          {value && <button className="btn btn-sm" onClick={() => onChange('')}>{t('common.clear')}</button>}
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
        spellCheck={false}
      />
      {dropped ? (
        <p className="mt-1.5 text-[11px] text-srose">{t('seq.invalid')} ({dropped})</p>
      ) : null}
    </div>
  );
}
