import { formatBlocks, AA_CLASS } from '../lib/bio/sequence';
import { useLang } from '../i18n';

function TruncationNotice({ shown, total }: { shown: number; total: number }) {
  const { t, formatNumber } = useLang();
  return (
    <p className="label mb-3 pb-2 border-b border-line">
      {t('seq.truncated')} — {formatNumber(shown)} / {formatNumber(total)}
    </p>
  );
}

const AA_COLOR: Record<string, string> = {
  hydrophobic: 'var(--s-rose)',
  polar: 'var(--s-green)',
  acidic: 'var(--danger)',
  basic: 'var(--s-blue)',
  special: 'var(--muted)'
};

/**
 * Every residue becomes its own <span> so it can be coloured, which puts a
 * hard ceiling on how much can be drawn: the file picker accepts two million
 * characters, and rendering that many nodes would hang the tab. Past the cap
 * the view shows the opening stretch and says so.
 */
const MAX_RENDERED = 20_000;

/**
 * Monospaced sequence display with a position gutter, coloured by nucleotide or
 * by amino-acid class. Long sequences scroll inside their own pane rather than
 * stretching the page.
 */
export function SeqView({ seq, kind = 'nucleotide', lineLength = 60, maxHeight = 260, highlight }: {
  seq: string;
  kind?: 'nucleotide' | 'protein' | 'plain';
  lineLength?: number;
  maxHeight?: number;
  /** 1-based inclusive range to mark. */
  highlight?: [number, number];
}) {
  if (!seq) return null;
  const truncated = seq.length > MAX_RENDERED;
  const shown = truncated ? seq.slice(0, MAX_RENDERED) : seq;
  const lines = formatBlocks(shown, lineLength, 10);
  const width = String(seq.length).length;

  const paint = (ch: string, index: number) => {
    const marked = highlight && index >= highlight[0] && index <= highlight[1];
    const style = marked ? { background: 'var(--accent-soft)', outline: '1px solid var(--accent)' } : undefined;
    if (kind === 'plain') return <span key={index} style={style}>{ch}</span>;
    if (kind === 'protein') {
      return <span key={index} style={{ color: AA_COLOR[AA_CLASS[ch] ?? 'special'], ...style }}>{ch}</span>;
    }
    return <span key={index} className={`nt-${ch}`} style={style}>{ch}</span>;
  };

  let position = 0;
  return (
    <div className="seq scroll-thin overflow-auto card p-3.5" style={{ maxHeight }}>
      {truncated && <TruncationNotice shown={MAX_RENDERED} total={seq.length} />}
      {lines.map(line => (
        <div key={line.start} className="flex gap-3 whitespace-pre">
          <span className="text-muted select-none shrink-0 opacity-60" style={{ minWidth: `${width}ch` }}>
            {String(line.start).padStart(width, ' ')}
          </span>
          <span>
            {line.blocks.map((block, bi) => (
              <span key={bi}>
                {block.split('').map(ch => paint(ch, ++position))}
                {bi < line.blocks.length - 1 ? ' ' : ''}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
