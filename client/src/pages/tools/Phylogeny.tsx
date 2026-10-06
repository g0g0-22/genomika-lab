import { useMemo, useState } from 'react';
import { useLang } from '../../i18n';
import { ToolShell, Panel, Metric } from '../../components/ToolShell';
import { SequenceInput } from '../../components/SequenceInput';
import { Toggle, CopyButton, Notice, download } from '../../components/ui';
import { parseFasta, cleanSequence } from '../../lib/bio/sequence';
import {
  distanceMatrix, upgma, neighbourJoining, toNewick, layoutTree,
  type DistanceModel
} from '../../lib/bio/phylo';
import { PHYLO_EXAMPLE } from '../../lib/bio/samples';

export default function Phylogeny() {
  const { t } = useLang();
  const [raw, setRaw] = useState('');
  const [model, setModel] = useState<DistanceModel>('jc');
  const [method, setMethod] = useState<'upgma' | 'nj'>('nj');
  const [hover, setHover] = useState<[number, number] | null>(null);

  const records = useMemo(
    () => parseFasta(raw).map(r => ({ ...r, seq: cleanSequence(r.seq).seq })).filter(r => r.seq.length > 0),
    [raw]
  );

  const labels = records.map(r => r.id);
  const matrix = useMemo(
    () => (records.length >= 2 ? distanceMatrix(records.map(r => r.seq), model) : []),
    [records, model]
  );

  const tree = useMemo(() => {
    if (records.length < 3) return null;
    return method === 'upgma' ? upgma(labels, matrix) : neighbourJoining(labels, matrix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, matrix, method]);

  const newick = tree ? toNewick(tree) : '';
  const layout = useMemo(() => layoutTree(tree), [tree]);

  const maxDistance = matrix.length ? Math.max(...matrix.flat()) : 1;
  const heat = (v: number) =>
    `color-mix(in oklab, var(--s-blue) ${Math.round((v / (maxDistance || 1)) * 78)}%, var(--bg-2))`;

  /* ------------------------------------------------------------ drawing */
  const width = 640;
  const rowHeight = 34;
  const labelSpace = 168;
  const height = Math.max(layout.leaves * rowHeight + 40, 140);
  const plotWidth = width - labelSpace - 24;
  const sx = (x: number) => 12 + (x / (layout.maxX || 1)) * plotWidth;
  const sy = (y: number) => 24 + y * rowHeight;

  return (
    <ToolShell index="05.4 / PHY" name="tool.phylo.name" desc="tool.phylo.desc">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        <aside className="space-y-6 lg:sticky lg:top-28">
          <Panel title={t('phylo.method')}>
            <div className="space-y-4">
              <Toggle
                ariaLabel={t('phylo.method')}
                value={method}
                onChange={v => setMethod(v as 'upgma' | 'nj')}
                options={[{ value: 'nj', label: 'NJ' }, { value: 'upgma', label: 'UPGMA' }]}
              />
              <p className="text-[12px] leading-relaxed text-muted">
                {method === 'nj' ? t('phylo.nj') : t('phylo.upgma')}
              </p>
              <div className="rule pt-4">
                <div className="label mb-2">{t('phylo.model')}</div>
                <Toggle
                  ariaLabel={t('phylo.model')}
                  value={model}
                  onChange={v => setModel(v as DistanceModel)}
                  options={[{ value: 'p', label: 'p-dist' }, { value: 'jc', label: 'JC69' }]}
                />
                <p className="text-[12px] leading-relaxed text-muted mt-3">
                  {model === 'jc' ? t('phylo.jc') : t('phylo.pdist')}
                </p>
              </div>
            </div>
          </Panel>

          {records.length > 0 && (
            <Panel title={t('common.results')}>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <Metric label={t('phylo.taxa')} value={records.length} />
                <Metric label={t('seq.length')} value={records[0]?.seq.length ?? 0} unit="nt" />
              </div>
            </Panel>
          )}
        </aside>

        <div className="space-y-6 min-w-0">
          <Panel>
            <SequenceInput
              label={`${t('seq.input')} — FASTA`}
              value={raw}
              onChange={setRaw}
              onExample={() => setRaw(PHYLO_EXAMPLE)}
              rows={8}
              placeholder=">taxon_1&#10;ATGACC…"
            />
          </Panel>

          {records.length < 3 ? (
            <Panel><Notice>{t('phylo.need')}</Notice></Panel>
          ) : (
            <>
              <Panel title={t('phylo.tree')}>
                <div className="scroll-thin overflow-auto">
                  <svg width={width} height={height} className="min-w-full" role="img"
                       aria-label={`${t('phylo.tree')} — ${method.toUpperCase()}`}>
                    {/* scale bar */}
                    <line x1={12} x2={sx(layout.maxX * 0.25)} y1={height - 12} y2={height - 12}
                          stroke="var(--muted)" strokeWidth="1.5" />
                    <text x={12} y={height - 18} fontSize="9" fill="var(--muted)" className="num">
                      {(layout.maxX * 0.25).toFixed(3)}
                    </text>

                    {layout.nodes.map((item, i) => {
                      const isLeaf = item.isLeaf;
                      const children = item.node.children
                        .map(child => layout.nodes.find(n => n.node === child))
                        .filter(Boolean) as typeof layout.nodes;
                      return (
                        <g key={i}>
                          {/* horizontal branch */}
                          <line
                            x1={sx(item.parentX)} x2={sx(item.x)}
                            y1={sy(item.y)} y2={sy(item.y)}
                            stroke={isLeaf ? 'var(--accent)' : 'var(--line)'}
                            strokeWidth={isLeaf ? 1.8 : 1.5}
                          />
                          {/* vertical connector across this node's children */}
                          {children.length > 1 && (
                            <line
                              x1={sx(item.x)} x2={sx(item.x)}
                              y1={sy(Math.min(...children.map(c => c.y)))}
                              y2={sy(Math.max(...children.map(c => c.y)))}
                              stroke="var(--line)" strokeWidth="1.5"
                            />
                          )}
                          {isLeaf && (
                            <>
                              <circle cx={sx(item.x)} cy={sy(item.y)} r="3.5" fill="var(--accent)" />
                              <text
                                x={sx(item.x) + 10} y={sy(item.y) + 4}
                                fontSize="12" fill="var(--ink)" className="font-mono"
                              >
                                {item.node.name.replace(/_/g, ' ')}
                              </text>
                              <text
                                x={width - 8} y={sy(item.y) + 4}
                                fontSize="9.5" textAnchor="end" fill="var(--muted)" className="num"
                              >
                                {item.node.branchLength.toFixed(4)}
                              </text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </Panel>

              <Panel title={t('phylo.distance')}>
                <div className="scroll-thin overflow-auto">
                  <table className="text-[11px] border-separate" style={{ borderSpacing: 2 }}>
                    <thead>
                      <tr>
                        <th />
                        {labels.map((label, j) => (
                          <th key={j} className="label font-normal px-1 pb-2 align-bottom">
                            <span className="inline-block whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                              {label.replace(/_/g, ' ')}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row, i) => (
                        <tr key={i}>
                          <th className="label font-normal text-right pr-2 whitespace-nowrap">
                            {labels[i].replace(/_/g, ' ')}
                          </th>
                          {row.map((value, j) => (
                            <td
                              key={j}
                              className="num text-center rounded-[2px] px-2 py-1.5 cursor-default"
                              style={{
                                background: i === j ? 'var(--bg-3)' : heat(value),
                                outline: hover && hover[0] === i && hover[1] === j ? '1px solid var(--accent)' : undefined
                              }}
                              onMouseEnter={() => setHover([i, j])}
                              onMouseLeave={() => setHover(null)}
                              title={`${labels[i]} ↔ ${labels[j]}`}
                            >
                              {value.toFixed(3)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel
                title={t('phylo.newick')}
                right={
                  <div className="flex gap-2">
                    <CopyButton text={newick} />
                    <button className="btn btn-sm" onClick={() => download(`tree-${method}.nwk`, newick)}>.nwk</button>
                  </div>
                }
              >
                <pre className="seq scroll-thin overflow-auto card p-3.5 whitespace-pre-wrap break-all">{newick}</pre>
              </Panel>
            </>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
