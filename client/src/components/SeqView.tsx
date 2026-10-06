import { formatBlocks, AA_CLASS } from '../lib/bio/sequence';

const AA_COLOR: Record<string, string> = {
  hydrophobic: 'var(--s-amber)',
  polar: 'var(--s-green)',
  acidic: 'var(--danger)',
  basic: 'var(--s-blue)',
  special: 'var(--muted)'
};

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
  const lines = formatBlocks(seq, lineLength, 10);
  const width = String(seq.length).length;

  const paint = (ch: string, index: number) => {
    const marked = highlight && index >= highlight[0] && index <= highlight[1];
    const style = marked ? { background: 'var(--glow)', outline: '1px solid var(--accent)' } : undefined;
    if (kind === 'plain') return <span key={index} style={style}>{ch}</span>;
    if (kind === 'protein') {
      return <span key={index} style={{ color: AA_COLOR[AA_CLASS[ch] ?? 'special'], ...style }}>{ch}</span>;
    }
    return <span key={index} className={`nt-${ch}`} style={style}>{ch}</span>;
  };

  let position = 0;
  return (
    <div className="seq scroll-thin overflow-auto card p-3.5" style={{ maxHeight }}>
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

/** Pairwise alignment display: two sequences with a match midline between them. */
export function AlignmentView({ a, b, midline, labelA, labelB, chunk = 60 }: {
  a: string; b: string; midline: string; labelA: string; labelB: string; chunk?: number;
}) {
  const rows: number[] = [];
  for (let i = 0; i < a.length; i += chunk) rows.push(i);
  const labelWidth = Math.max(labelA.length, labelB.length, 3);

  const countReal = (s: string, upTo: number) => {
    let n = 0;
    for (let i = 0; i < upTo; i++) if (s[i] !== '-') n++;
    return n;
  };

  return (
    <div className="seq scroll-thin overflow-auto card p-3.5">
      {rows.map(offset => {
        const sliceA = a.slice(offset, offset + chunk);
        const sliceB = b.slice(offset, offset + chunk);
        const sliceMid = midline.slice(offset, offset + chunk);
        const startA = countReal(a, offset) + 1;
        const startB = countReal(b, offset) + 1;
        return (
          <div key={offset} className="mb-4 last:mb-0 whitespace-pre">
            <div className="flex gap-3">
              <span className="text-muted shrink-0" style={{ minWidth: `${labelWidth}ch` }}>{labelA.padEnd(labelWidth)}</span>
              <span className="text-muted opacity-60 shrink-0 w-12 text-right">{startA}</span>
              <span>{sliceA.split('').map((ch, i) => (
                <span key={i} className={ch === '-' ? 'text-muted' : `nt-${ch}`}>{ch}</span>
              ))}</span>
            </div>
            <div className="flex gap-3">
              <span className="shrink-0" style={{ minWidth: `${labelWidth}ch` }} />
              <span className="shrink-0 w-12" />
              <span className="text-accent">{sliceMid}</span>
            </div>
            <div className="flex gap-3">
              <span className="text-muted shrink-0" style={{ minWidth: `${labelWidth}ch` }}>{labelB.padEnd(labelWidth)}</span>
              <span className="text-muted opacity-60 shrink-0 w-12 text-right">{startB}</span>
              <span>{sliceB.split('').map((ch, i) => (
                <span key={i} className={ch === '-' ? 'text-muted' : `nt-${ch}`}>{ch}</span>
              ))}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
