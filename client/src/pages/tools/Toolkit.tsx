import { Fragment, useMemo, useState } from 'react';
import { useLang } from '../../i18n';
import { ToolShell, Panel, Metric } from '../../components/ToolShell';
import { SequenceInput } from '../../components/SequenceInput';
import { SeqView } from '../../components/SeqView';
import { Toggle, CopyButton, download, Empty } from '../../components/ui';
import {
  parseFasta, cleanSequence, detectKind, reverseComplement, complement, reverse,
  transcribe, translate, translateAllFrames, findOrfs, gcContent, baseCounts,
  molecularWeight, meltingTemp, toFasta
} from '../../lib/bio/sequence';
import { HBB_CDS } from '../../lib/bio/samples';

const NT_COLOR: Record<string, string> = {
  A: '#3F7D5A', C: '#3C6490', G: '#9A7430', T: '#A24B46', U: '#A24B46', N: 'var(--muted)'
};

export default function Toolkit() {
  const { t, lang, formatNumber } = useLang();
  const [raw, setRaw] = useState('');
  const [tab, setTab] = useState('transform');
  const [minAa, setMinAa] = useState(30);
  const [openOrf, setOpenOrf] = useState<number | null>(null);

  const { seq, dropped, id } = useMemo(() => {
    const records = parseFasta(raw);
    const joined = records.map(r => r.seq).join('');
    const cleaned = cleanSequence(joined);
    return { seq: cleaned.seq, dropped: cleaned.dropped, id: records[0]?.id ?? 'sequence' };
  }, [raw]);

  const kind = detectKind(seq);
  const counts = useMemo(() => baseCounts(seq), [seq]);
  const orfs = useMemo(() => (seq ? findOrfs(seq, minAa) : []), [seq, minAa]);
  const frames = useMemo(() => (seq ? translateAllFrames(seq) : []), [seq]);

  const composition = (['A', 'C', 'G', kind === 'rna' ? 'U' : 'T'] as const)
    .map(base => ({ base, count: counts[base] ?? 0 }));

  return (
    <ToolShell index="05.1 / SEQ" name="tool.toolkit.name" desc="tool.toolkit.desc">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="space-y-6 min-w-0">
          <Panel>
            <SequenceInput
              value={raw}
              onChange={setRaw}
              onExample={() => setRaw(`>HBB Homo sapiens haemoglobin subunit beta\n${HBB_CDS}`)}
              dropped={dropped}
              rows={7}
            />
          </Panel>

          {!seq ? (
            <Panel><Empty label={t('seq.empty')} /></Panel>
          ) : (
            <>
              <Panel
                right={
                  <Toggle
                    ariaLabel={t('common.results')}
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: 'transform', label: t('seq.revcomp') },
                      { value: 'translate', label: t('seq.protein') },
                      { value: 'orf', label: 'ORF' }
                    ]}
                  />
                }
              >
                {tab === 'transform' && (
                  <div className="space-y-6">
                    {[
                      { label: t('seq.complement'), value: complement(seq) },
                      { label: t('seq.reverse'), value: reverse(seq) },
                      { label: t('seq.revcomp'), value: reverseComplement(seq) },
                      { label: t('seq.rna'), value: transcribe(seq) }
                    ].map(row => (
                      <div key={row.label}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h3 className="label">{row.label}</h3>
                          <div className="flex gap-2">
                            <CopyButton text={row.value} />
                            <button className="btn btn-sm" onClick={() => download(`${id}-${row.label}.fasta`, toFasta(`${id}_${row.label}`, row.value))}>
                              FASTA
                            </button>
                          </div>
                        </div>
                        <SeqView seq={row.value} maxHeight={150} />
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'translate' && (
                  <div className="space-y-5">
                    <p className="text-[13px] text-muted">
                      {t('seq.protein')} — {t('seq.frame')} +1 … −3. <span className="num">{t('seq.stopcodon')} = *</span>
                    </p>
                    {frames.map(frame => (
                      <div key={frame.frame}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h3 className="label">
                            {t('seq.frame')} {frame.frame > 0 ? `+${frame.frame}` : frame.frame}
                            <span className="ml-2 text-muted normal-case tracking-normal">
                              {frame.protein.length} aa
                            </span>
                          </h3>
                          <CopyButton text={frame.protein} />
                        </div>
                        <SeqView seq={frame.protein} kind="protein" maxHeight={110} />
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'orf' && (
                  <div>
                    <div className="flex flex-wrap items-center gap-4 mb-5">
                      <label className="flex items-center gap-3 flex-1 min-w-[240px]">
                        <span className="label whitespace-nowrap">{t('seq.orf.min')}</span>
                        <input
                          type="range" min={10} max={200} step={5} value={minAa}
                          onChange={e => setMinAa(Number(e.target.value))}
                          className="flex-1 accent-[var(--accent)]"
                        />
                        <span className="num text-sm w-10 text-right">{minAa}</span>
                      </label>
                      <span className="chip chip-on">{orfs.length} ORF</span>
                    </div>

                    {orfs.length === 0 ? (
                      <p className="text-sm text-muted py-6">{t('seq.orf.none')}</p>
                    ) : (
                      <div className="scroll-thin overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="border-b border-line">
                              {[t('seq.orf.strand'), t('seq.frame'), t('seq.orf.start'), t('seq.orf.end'), t('seq.length'), t('seq.orf.aa'), ''].map((h, i) => (
                                <th key={i} className="label text-left py-2 font-normal">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {orfs.map((orf, i) => (
                              <Fragment key={i}>
                                <tr className="border-b border-linesoft">
                                  <td className="py-2.5 num" style={{ color: orf.strand === '+' ? 'var(--s-green)' : 'var(--s-blue)' }}>{orf.strand}</td>
                                  <td className="py-2.5 num">{orf.frame > 0 ? `+${orf.frame}` : orf.frame}</td>
                                  <td className="py-2.5 num">{orf.start}</td>
                                  <td className="py-2.5 num">{orf.end}</td>
                                  <td className="py-2.5 num">{orf.length}</td>
                                  <td className="py-2.5 num">{orf.protein.length}</td>
                                  <td className="py-2.5 text-right">
                                    <button className="btn btn-sm" onClick={() => setOpenOrf(openOrf === i ? null : i)}>
                                      {openOrf === i ? t('common.close') : t('seq.protein')}
                                    </button>
                                  </td>
                                </tr>
                                {openOrf === i && (
                                  <tr>
                                    <td colSpan={7} className="py-3">
                                      <SeqView seq={orf.protein} kind="protein" maxHeight={130} />
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Panel>

              <Panel title={t('seq.input')} right={<CopyButton text={seq} />}>
                <SeqView seq={seq} maxHeight={220} highlight={openOrf !== null && orfs[openOrf]?.strand === '+' ? [orfs[openOrf].start, orfs[openOrf].end] : undefined} />
              </Panel>
            </>
          )}
        </div>

        {/* ---------------------------------------------------- side panel */}
        <aside className="space-y-6 lg:sticky lg:top-28">
          <Panel title={t('common.results')}>
            {!seq ? (
              <p className="text-[13px] text-muted">{t('seq.empty')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <Metric label={t('seq.length')} value={formatNumber(seq.length)} unit="nt" />
                <Metric label={t('seq.gc')} value={`${(gcContent(seq) * 100).toFixed(1)}`} unit="%" />
                <Metric label={t('seq.tm')} value={meltingTemp(seq).toFixed(1)} unit="°C" />
                <Metric label={t('seq.mw')} value={formatNumber(Math.round(molecularWeight(seq) / 1000))} unit="kDa" />
                <div className="col-span-2">
                  <div className="label mb-2">{t('common.type')}</div>
                  <span className="chip chip-on uppercase">{kind}</span>
                  <span className="chip ml-2">{id}</span>
                </div>
              </div>
            )}
          </Panel>

          {seq && (
            <Panel title={t('seq.composition')}>
              <ul className="space-y-2.5">
                {composition.map(row => {
                  const share = seq.length ? row.count / seq.length : 0;
                  return (
                    <li key={row.base}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className={`num text-sm nt-${row.base}`}>{row.base}</span>
                        <span className="num text-[11px] text-muted">
                          {formatNumber(row.count)} · {(share * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-bg3 rounded-[3px] overflow-hidden">
                        <div className="h-full rounded-[3px] transition-[width] duration-500"
                             style={{ width: `${share * 100}%`, background: NT_COLOR[row.base] }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {counts.N > 0 && (
                <p className="label mt-4">N: {formatNumber(counts.N)}</p>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </ToolShell>
  );
}
