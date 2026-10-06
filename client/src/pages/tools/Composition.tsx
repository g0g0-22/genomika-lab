import { useMemo, useState } from 'react';
import { useLang } from '../../i18n';
import { ToolShell, Panel, Metric } from '../../components/ToolShell';
import { SequenceInput } from '../../components/SequenceInput';
import { Toggle, Notice, download } from '../../components/ui';
import { BarChart, LineChart } from '../../components/charts';
import {
  parseFasta, cleanSequence, detectKind, topKmers, codonUsage, gcSkew,
  hydropathyProfile, gcContent, CODON_TABLE, AA_NAMES, PROTEIN_ALPHABET, DNA_ALPHABET
} from '../../lib/bio/sequence';
import { HBB_CDS, ENZYME_PROTEIN } from '../../lib/bio/samples';

export default function Composition() {
  const { t, lang, formatNumber } = useLang();
  const [raw, setRaw] = useState('');
  const [k, setK] = useState(3);
  const [window, setWindow] = useState(9);
  const [tab, setTab] = useState('kmer');

  const kind = useMemo(() => {
    const joined = parseFasta(raw).map(r => r.seq).join('');
    return detectKind(cleanSequence(joined, `${DNA_ALPHABET}${PROTEIN_ALPHABET}`).seq);
  }, [raw]);

  const isProtein = kind === 'protein';
  const seq = useMemo(() => {
    const joined = parseFasta(raw).map(r => r.seq).join('');
    return cleanSequence(joined, isProtein ? PROTEIN_ALPHABET : DNA_ALPHABET).seq;
  }, [raw, isProtein]);

  const kmers = useMemo(() => (!isProtein && seq ? topKmers(seq, k, 24) : []), [seq, k, isProtein]);
  const usage = useMemo(() => (!isProtein && seq ? codonUsage(seq) : null), [seq, isProtein]);
  const skew = useMemo(
    () => (!isProtein && seq.length > 200 ? gcSkew(seq, Math.max(50, Math.floor(seq.length / 40))) : []),
    [seq, isProtein]
  );
  const hydro = useMemo(() => (isProtein ? hydropathyProfile(seq, window) : []), [seq, window, isProtein]);

  const exportKmers = () =>
    download(`kmers-k${k}.csv`, 'kmer,count\n' + kmers.map(x => `${x.kmer},${x.count}`).join('\n'), 'text/csv');

  const aminoAcids = usage ? [...usage.byAminoAcid.entries()].sort((a, b) => a[0].localeCompare(b[0])) : [];

  return (
    <ToolShell index="05.5 / CMP" name="tool.comp.name" desc="tool.comp.desc">
      <div className="space-y-6">
        <Panel>
          <SequenceInput
            value={raw}
            onChange={setRaw}
            onExample={() => setRaw(`>HBB Homo sapiens haemoglobin subunit beta\n${HBB_CDS}`)}
            rows={6}
            extra={
              <button
                className="btn btn-sm"
                onClick={() => setRaw(`>GH1 thermophilic glycoside hydrolase\n${ENZYME_PROTEIN}`)}
              >
                {t('comp.hydro').split(' ')[0]}
              </button>
            }
          />
          <p className="label mt-3">
            {isProtein
              ? `${formatNumber(seq.length)} aa`
              : `${formatNumber(seq.length)} nt · GC ${(gcContent(seq) * 100).toFixed(1)}%`}
          </p>
        </Panel>

        {!seq ? (
          <Panel><p className="text-sm text-muted py-6">{t('seq.empty')}</p></Panel>
        ) : isProtein ? (
          /* ------------------------------------------------ protein view */
          <Panel
            title={t('comp.hydro')}
            right={
              <label className="flex items-center gap-3">
                <span className="label">{t('comp.window')}</span>
                <input
                  type="range" min={5} max={25} step={2} value={window}
                  onChange={e => setWindow(Number(e.target.value))}
                  className="accent-[var(--accent)] w-32"
                />
                <span className="num text-sm w-6">{window}</span>
              </label>
            }
          >
            {hydro.length === 0 ? (
              <Notice>{t('phylo.need')}</Notice>
            ) : (
              <>
                <HydroPlot data={hydro} />
                <div className="flex gap-6 mt-4">
                  <span className="text-[11px] text-muted flex items-center gap-2">
                    <span className="w-3 h-2 rounded-[2px]" style={{ background: 'var(--s-amber)' }} /> {t('comp.hydrophobic')}
                  </span>
                  <span className="text-[11px] text-muted flex items-center gap-2">
                    <span className="w-3 h-2 rounded-[2px]" style={{ background: 'var(--s-blue)' }} /> {t('comp.hydrophilic')}
                  </span>
                </div>
              </>
            )}
          </Panel>
        ) : (
          /* --------------------------------------------- nucleotide view */
          <>
            <Panel
              right={
                <Toggle
                  ariaLabel={t('common.results')}
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'kmer', label: 'k-mer' },
                    { value: 'codon', label: t('comp.codon') },
                    { value: 'skew', label: 'GC skew' }
                  ]}
                />
              }
            >
              {tab === 'kmer' && (
                <div>
                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <label className="flex items-center gap-3">
                      <span className="label">{t('comp.k')}</span>
                      <input
                        type="range" min={1} max={6} value={k}
                        onChange={e => setK(Number(e.target.value))}
                        className="accent-[var(--accent)] w-40"
                      />
                      <span className="num text-sm w-4">{k}</span>
                    </label>
                    <span className="chip">4^{k} = {formatNumber(4 ** k)}</span>
                    <button className="btn btn-sm ml-auto" onClick={exportKmers}>CSV</button>
                  </div>
                  <h3 className="label mb-4">{t('comp.top')} — {t('comp.count')}</h3>
                  <BarChart data={kmers.map(x => ({ label: x.kmer, value: x.count }))} height={220} />
                </div>
              )}

              {tab === 'codon' && usage && (
                <div>
                  <p className="label mb-4">{formatNumber(usage.total)} codons · frame +1</p>
                  <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                    {aminoAcids.map(([aa, list]) => (
                      <div key={aa}>
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="num text-sm text-accent">{aa}</span>
                          <span className="text-[11px] text-muted truncate">
                            {AA_NAMES[aa]?.[lang === 'mk' ? 0 : 1] ?? ''}
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {list.map(item => (
                            <li key={item.codon} className="flex items-center gap-2">
                              <span className="num text-[11px] w-9 text-ink2">{item.codon}</span>
                              <span className="flex-1 h-1.5 bg-bg3 rounded-[3px] overflow-hidden">
                                <span className="block h-full rounded-[3px] bg-accent transition-[width] duration-500"
                                      style={{ width: `${item.fraction * 100}%` }} />
                              </span>
                              <span className="num text-[10px] text-muted w-8 text-right">{item.count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'skew' && (
                skew.length < 3 ? (
                  <Notice>{t('phylo.need')}</Notice>
                ) : (
                  <div>
                    <h3 className="label mb-4">{t('comp.gcskew')} — (G − C) / (G + C)</h3>
                    <LineChart
                      data={skew.map(p => ({ label: String(p.position), value: Number(p.skew.toFixed(3)) }))}
                      height={200}
                    />
                    <h3 className="label mt-8 mb-4">{t('seq.gc')} %</h3>
                    <LineChart
                      data={skew.map(p => ({ label: String(p.position), value: Number((p.gc * 100).toFixed(1)) }))}
                      height={180}
                      valueSuffix="%"
                      color="var(--s-blue)"
                    />
                  </div>
                )
              )}
            </Panel>

            <Panel title={t('common.demo')}>
              <p className="text-[13px] leading-relaxed text-ink2">
                {lang === 'mk'
                  ? 'Внесете протеинска секвенца за да се појави Kyte–Doolittle профилот на хидрофобност. Типот на секвенцата се препознава автоматски.'
                  : 'Enter a protein sequence and the Kyte–Doolittle hydrophobicity profile appears instead. The sequence type is detected automatically.'}
              </p>
            </Panel>
          </>
        )}
      </div>
    </ToolShell>
  );
}

/* ----------------------------------------------------------- HYDRO PLOT -- */

function HydroPlot({ data }: { data: { position: number; value: number }[] }) {
  const width = 900;
  const height = 240;
  const pad = { top: 16, right: 12, bottom: 28, left: 38 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const bound = Math.max(4.5, ...data.map(d => Math.abs(d.value)));

  const x = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const y = (v: number) => pad.top + innerH / 2 - (v / bound) * (innerH / 2);

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const zero = y(0);

  return (
    <div className="scroll-thin overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[560px]" style={{ height }}
           role="img" aria-label="Kyte–Doolittle hydrophobicity">
        <defs>
          <clipPath id="above"><rect x="0" y="0" width={width} height={zero} /></clipPath>
          <clipPath id="below"><rect x="0" y={zero} width={width} height={height - zero} /></clipPath>
        </defs>

        {[bound, bound / 2, 0, -bound / 2, -bound].map(tick => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)}
                  stroke="var(--line)" strokeWidth={tick === 0 ? 1.4 : 1} strokeDasharray={tick === 0 ? undefined : '3 4'} />
            <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end" fontSize="9" fill="var(--muted)" className="num">
              {tick.toFixed(1)}
            </text>
          </g>
        ))}

        <path d={`${line} L${x(data.length - 1)},${zero} L${x(0)},${zero} Z`}
              fill="var(--s-amber)" fillOpacity=".24" clipPath="url(#above)" />
        <path d={`${line} L${x(data.length - 1)},${zero} L${x(0)},${zero} Z`}
              fill="var(--s-blue)" fillOpacity=".24" clipPath="url(#below)" />
        <path d={line} fill="none" stroke="var(--ink2)" strokeWidth="1.6" strokeLinejoin="round" />

        {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
          <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--muted)" className="num">
            {data[i]?.position}
          </text>
        ))}
      </svg>
    </div>
  );
}
