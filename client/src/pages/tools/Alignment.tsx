import { useMemo, useState } from 'react';
import { useLang } from '../../i18n';
import { ToolShell, Panel, Metric } from '../../components/ToolShell';
import { SequenceInput } from '../../components/SequenceInput';
import { AlignmentView } from '../../components/SeqView';
import { Toggle, Field, CopyButton, download, Notice } from '../../components/ui';
import { align, MAX_ALIGN_LENGTH, type AlignMode } from '../../lib/bio/align';
import { cleanSequence, parseFasta, PROTEIN_ALPHABET } from '../../lib/bio/sequence';
import { ALIGN_EXAMPLE_A, ALIGN_EXAMPLE_B, ALIGN_PROTEIN_A, ALIGN_PROTEIN_B } from '../../lib/bio/samples';

const MATRIX_LIMIT = 60;
const CELL = 17;

export default function Alignment() {
  const { t, formatNumber } = useLang();
  const [rawA, setRawA] = useState('');
  const [rawB, setRawB] = useState('');
  const [mode, setMode] = useState<AlignMode>('global');
  const [substitution, setSubstitution] = useState<'simple' | 'blosum62'>('simple');
  const [match, setMatch] = useState(2);
  const [mismatch, setMismatch] = useState(-1);
  const [gap, setGap] = useState(-2);
  const [animate, setAnimate] = useState(true);
  const [runId, setRunId] = useState(0);
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);

  const alphabet = substitution === 'blosum62' ? PROTEIN_ALPHABET : undefined;
  const a = useMemo(() => cleanSequence(parseFasta(rawA).map(r => r.seq).join(''), alphabet).seq.slice(0, MAX_ALIGN_LENGTH), [rawA, substitution]);
  const b = useMemo(() => cleanSequence(parseFasta(rawB).map(r => r.seq).join(''), alphabet).seq.slice(0, MAX_ALIGN_LENGTH), [rawB, substitution]);

  const result = useMemo(
    () => (a && b ? align(a, b, { match, mismatch, gap, mode, substitution }) : null),
    [a, b, match, mismatch, gap, mode, substitution]
  );

  const loadExample = () => {
    if (substitution === 'blosum62') { setRawA(ALIGN_PROTEIN_A); setRawB(ALIGN_PROTEIN_B); }
    else { setRawA(ALIGN_EXAMPLE_A); setRawB(ALIGN_EXAMPLE_B); }
    setRunId(n => n + 1);
  };

  const drawMatrix = result && a.length <= MATRIX_LIMIT && b.length <= MATRIX_LIMIT;
  const pathSet = useMemo(
    () => new Set(result?.path.map(([i, j]) => `${i},${j}`) ?? []),
    [result]
  );

  const extremes = useMemo(() => {
    if (!result) return { min: 0, max: 1 };
    let min = Infinity, max = -Infinity;
    for (const row of result.scores) for (const v of row) { if (v < min) min = v; if (v > max) max = v; }
    return { min, max: max === min ? min + 1 : max };
  }, [result]);

  const cellFill = (value: number) => {
    const ratio = (value - extremes.min) / (extremes.max - extremes.min);
    return `color-mix(in oklab, var(--accent) ${Math.round(ratio * 74)}%, var(--bg-2))`;
  };

  const exportAlignment = () => {
    if (!result) return;
    const text =
      `# GenomikaLab alignment\n# algorithm: ${mode === 'global' ? 'Needleman-Wunsch' : 'Smith-Waterman'}\n` +
      `# scoring: ${substitution === 'blosum62' ? 'BLOSUM62' : `match ${match} / mismatch ${mismatch}`}, gap ${gap}\n` +
      `# score: ${result.score}  identity: ${(result.identity * 100).toFixed(1)}%\n\n` +
      `A  ${result.alignedA}\n   ${result.midline}\nB  ${result.alignedB}\n`;
    download('alignment.txt', text);
  };

  return (
    <ToolShell index="05.2 / ALN" name="tool.align.name" desc="tool.align.desc">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        {/* ------------------------------------------------------ controls */}
        <aside className="space-y-6 lg:sticky lg:top-28">
          <Panel title={t('align.mode')}>
            <div className="space-y-4">
              <Toggle
                ariaLabel={t('align.mode')}
                value={mode}
                onChange={v => { setMode(v as AlignMode); setRunId(n => n + 1); }}
                options={[{ value: 'global', label: 'NW' }, { value: 'local', label: 'SW' }]}
              />
              <p className="text-[12px] leading-relaxed text-muted">
                {mode === 'global' ? t('align.global') : t('align.local')}
              </p>

              <div className="rule pt-4">
                <Toggle
                  ariaLabel="substitution"
                  value={substitution}
                  onChange={v => { setSubstitution(v as 'simple' | 'blosum62'); setRunId(n => n + 1); }}
                  options={[{ value: 'simple', label: 'DNA' }, { value: 'blosum62', label: 'BLOSUM62' }]}
                />
              </div>

              {substitution === 'simple' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Field label={t('align.match')}>
                    <input type="number" className="input num" value={match} onChange={e => setMatch(Number(e.target.value))} />
                  </Field>
                  <Field label={t('align.mismatch')}>
                    <input type="number" className="input num" value={mismatch} onChange={e => setMismatch(Number(e.target.value))} />
                  </Field>
                </div>
              )}
              <Field label={t('align.gap')}>
                <input type="number" className="input num" value={gap} max={0} onChange={e => setGap(Math.min(0, Number(e.target.value)))} />
              </Field>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input type="checkbox" checked={animate} onChange={e => setAnimate(e.target.checked)} className="accent-[var(--accent)]" />
                <span className="text-[12px] text-ink2">{t('align.animate')}</span>
              </label>
              <button className="btn w-full justify-center" onClick={() => setRunId(n => n + 1)}>{t('common.run')} ↻</button>
            </div>
          </Panel>

          {result && (
            <Panel title={t('common.results')}>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <Metric label={t('align.score')} value={<span className="text-accent">{result.score}</span>} />
                <Metric label={t('align.identity')} value={`${(result.identity * 100).toFixed(1)}`} unit="%" />
                <Metric label={t('align.gaps')} value={result.gaps} />
                <Metric label={t('seq.length')} value={result.length} />
                <div className="col-span-2 label">{formatNumber(result.cells)} {t('align.cells')}</div>
              </div>
              <div className="flex gap-2 mt-5">
                <CopyButton text={`${result.alignedA}\n${result.midline}\n${result.alignedB}`} />
                <button className="btn btn-sm" onClick={exportAlignment}>{t('common.download')}</button>
              </div>
            </Panel>
          )}
        </aside>

        {/* ------------------------------------------------------- results */}
        <div className="space-y-6 min-w-0">
          <Panel>
            <div className="grid gap-5 md:grid-cols-2">
              <SequenceInput label={t('align.seq1')} value={rawA} onChange={setRawA} rows={4} />
              <SequenceInput label={t('align.seq2')} value={rawB} onChange={setRawB} onExample={loadExample} rows={4} />
            </div>
          </Panel>

          {result && (
            <Panel title={t('align.result')}>
              <AlignmentView a={result.alignedA} b={result.alignedB} midline={result.midline} labelA="A" labelB="B" />
            </Panel>
          )}

          {result && (
            <Panel title={t('align.matrix')}>
              <p className="text-[12.5px] leading-relaxed text-muted mb-4">{t('align.matrixnote')}</p>
              {!drawMatrix ? (
                <Notice>{t('align.toolong')}</Notice>
              ) : (
                <>
                  <div className="scroll-thin overflow-auto" style={{ maxHeight: 560 }}>
                    <svg
                      key={runId}
                      width={(b.length + 2) * CELL}
                      height={(a.length + 2) * CELL}
                      className="font-mono"
                      role="img"
                      aria-label={`${t('align.matrix')} ${a.length} × ${b.length}`}
                      onMouseLeave={() => setHover(null)}
                    >
                      {/* column headers */}
                      {b.split('').map((ch, j) => (
                        <text key={`c${j}`} x={(j + 2) * CELL + CELL / 2} y={CELL - 5}
                              textAnchor="middle" fontSize="10" fill="var(--muted)" className={`nt-${ch}`}>
                          {ch}
                        </text>
                      ))}
                      {/* row headers */}
                      {a.split('').map((ch, i) => (
                        <text key={`r${i}`} x={CELL / 2} y={(i + 2) * CELL + CELL / 2 + 3}
                              textAnchor="middle" fontSize="10" fill="var(--muted)" className={`nt-${ch}`}>
                          {ch}
                        </text>
                      ))}

                      {result.scores.map((row, i) =>
                        row.map((value, j) => {
                          const onPath = pathSet.has(`${i},${j}`);
                          const isHover = hover?.i === i && hover?.j === j;
                          return (
                            <g
                              key={`${i}-${j}`}
                              className={animate ? 'fade' : undefined}
                              style={animate ? { animationDelay: `${(i + j) * 9}ms`, animationDuration: '.35s' } : undefined}
                              onMouseEnter={() => setHover({ i, j })}
                            >
                              <rect
                                x={(j + 1) * CELL + 1} y={(i + 1) * CELL + 1}
                                width={CELL - 2} height={CELL - 2}
                                rx="2"
                                fill={cellFill(value)}
                                stroke={onPath ? 'var(--accent)' : isHover ? 'var(--ink2)' : 'transparent'}
                                strokeWidth={onPath ? 1.4 : 1}
                              />
                              <text
                                x={(j + 1) * CELL + CELL / 2} y={(i + 1) * CELL + CELL / 2 + 3}
                                textAnchor="middle" fontSize="8.5"
                                fill={onPath ? 'var(--ink)' : 'var(--ink2)'}
                                fontWeight={onPath ? 600 : 400}
                              >
                                {value}
                              </text>
                            </g>
                          );
                        })
                      )}

                      {/* traceback path */}
                      <polyline
                        points={result.path.map(([i, j]) => `${(j + 1) * CELL + CELL / 2},${(i + 1) * CELL + CELL / 2}`).join(' ')}
                        fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeOpacity=".65"
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                    {[
                      { key: 'diag', label: t('align.legend.diag'), glyph: '↖' },
                      { key: 'up', label: t('align.legend.up'), glyph: '↑' },
                      { key: 'left', label: t('align.legend.left'), glyph: '←' }
                    ].map(item => (
                      <span key={item.key} className="text-[11px] text-muted flex items-center gap-2">
                        <span className="num text-accent">{item.glyph}</span> {item.label}
                      </span>
                    ))}
                    {hover && (
                      <span className="ml-auto num text-[11px] text-ink2">
                        [{hover.i},{hover.j}] = {result.scores[hover.i][hover.j]} · {result.pointers[hover.i][hover.j]}
                      </span>
                    )}
                  </div>
                </>
              )}
            </Panel>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
