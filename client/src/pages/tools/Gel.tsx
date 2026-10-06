import { useMemo, useState } from 'react';
import { useLang } from '../../i18n';
import { ToolShell, Panel, Metric } from '../../components/ToolShell';
import { SequenceInput } from '../../components/SequenceInput';
import { Toggle, Notice, download } from '../../components/ui';
import {
  ENZYMES, findCutSites, digest, recognitionSequence, migration,
  LADDER_1KB, LADDER_100BP, GEL_RANGES, type Enzyme
} from '../../lib/bio/enzymes';
import { cleanSequence, parseFasta } from '../../lib/bio/sequence';
import { PLASMID_FRAGMENT } from '../../lib/bio/samples';

const GEL_HEIGHT = 380;
const LANE_WIDTH = 74;

export default function Gel() {
  const { t, formatNumber } = useLang();
  const [raw, setRaw] = useState('');
  const [selected, setSelected] = useState<string[]>(['EcoRI', 'BamHI', 'HindIII']);
  const [agarose, setAgarose] = useState('1.0');
  const [topology, setTopology] = useState('linear');
  const [runId, setRunId] = useState(0);

  const seq = useMemo(
    () => cleanSequence(parseFasta(raw).map(r => r.seq).join('')).seq,
    [raw]
  );

  const enzymes = useMemo(
    () => ENZYMES.filter(e => selected.includes(e.name)),
    [selected]
  );

  const sites = useMemo(() => (seq ? findCutSites(seq, enzymes) : []), [seq, enzymes]);
  const fragments = useMemo(
    () => (seq ? digest(seq, sites, topology === 'circular') : []),
    [seq, sites, topology]
  );

  const [minBp, maxBp] = GEL_RANGES[agarose];
  const ladder = maxBp <= 4000 ? LADDER_100BP : LADDER_1KB;

  const toggleEnzyme = (name: string) =>
    setSelected(list => (list.includes(name) ? list.filter(n => n !== name) : [...list, name]));

  const exportFragments = () => {
    const header = 'fragment,start,end,length_bp,left_enzyme,right_enzyme\n';
    const body = fragments
      .map((f, i) => `${i + 1},${f.start},${f.end},${f.length},${f.leftEnzyme ?? ''},${f.rightEnzyme ?? ''}`)
      .join('\n');
    download('digest-fragments.csv', header + body, 'text/csv');
  };

  const bandY = (length: number) => 26 + migration(length, minBp, maxBp) * (GEL_HEIGHT - 56);

  return (
    <ToolShell index="05.3 / GEL" name="tool.gel.name" desc="tool.gel.desc">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        {/* ------------------------------------------------------ controls */}
        <aside className="space-y-6 lg:sticky lg:top-28">
          <Panel title={t('gel.enzymes')} right={<span className="chip chip-on">{selected.length}</span>}>
            <div className="flex flex-wrap gap-1.5 max-h-[260px] overflow-auto scroll-thin">
              {ENZYMES.map((enzyme: Enzyme) => (
                <button
                  key={enzyme.name}
                  onClick={() => toggleEnzyme(enzyme.name)}
                  aria-pressed={selected.includes(enzyme.name)}
                  title={`${recognitionSequence(enzyme)} · ${enzyme.supplier}`}
                  className={`chip transition-colors ${selected.includes(enzyme.name) ? 'chip-on' : 'hover:text-ink'}`}
                >
                  {enzyme.name}
                </button>
              ))}
            </div>
            {selected.length > 0 && (
              <ul className="mt-4 space-y-1.5 rule pt-4">
                {enzymes.map(enzyme => (
                  <li key={enzyme.name} className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="num text-accent">{enzyme.name}</span>
                    <span className="num text-muted tracking-wider">{enzyme.site}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t('gel.agarose')}>
            <div className="space-y-4">
              <Toggle
                ariaLabel={t('gel.agarose')}
                value={agarose}
                onChange={setAgarose}
                options={Object.keys(GEL_RANGES).map(v => ({ value: v, label: `${v}%` }))}
              />
              <p className="label">{formatNumber(minBp)} – {formatNumber(maxBp)} bp</p>
              <div className="rule pt-4">
                <Toggle
                  ariaLabel="topology"
                  value={topology}
                  onChange={setTopology}
                  options={[{ value: 'linear', label: 'linear' }, { value: 'circular', label: 'circular' }]}
                />
              </div>
              <button className="btn btn-primary w-full justify-center" onClick={() => setRunId(n => n + 1)} disabled={!seq}>
                ⚡ {t('gel.run')}
              </button>
            </div>
          </Panel>

          {seq && (
            <Panel title={t('common.results')}>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <Metric label={t('seq.length')} value={formatNumber(seq.length)} unit="bp" />
                <Metric label={t('gel.sites')} value={sites.length} />
                <Metric label={t('gel.fragments')} value={fragments.length} />
                <Metric label="max" value={formatNumber(fragments[0]?.length ?? 0)} unit="bp" />
              </div>
              {fragments.length > 1 && (
                <button className="btn btn-sm mt-5 w-full justify-center" onClick={exportFragments}>CSV</button>
              )}
            </Panel>
          )}
        </aside>

        {/* --------------------------------------------------------- panes */}
        <div className="space-y-6 min-w-0">
          <Panel>
            <SequenceInput
              value={raw}
              onChange={setRaw}
              onExample={() => { setRaw(`>pGL-demo synthetic multiple cloning site\n${PLASMID_FRAGMENT}`); setRunId(n => n + 1); }}
              rows={5}
            />
          </Panel>

          {!seq ? (
            <Panel><p className="text-sm text-muted py-6">{t('seq.empty')}</p></Panel>
          ) : selected.length === 0 ? (
            <Panel><Notice>{t('gel.hint')}</Notice></Panel>
          ) : (
            <>
              {/* -------------------------------------------- sequence map */}
              <Panel title={t('gel.map')}>
                <div className="relative h-24 mt-2">
                  <div className="absolute inset-x-0 top-10 h-2.5 rounded-[3px] bg-bg3 border border-line" />
                  {sites.map((site, i) => {
                    const left = (site.position / seq.length) * 100;
                    return (
                      <div key={i} className="absolute top-0" style={{ left: `${left}%` }}>
                        <div className="w-px h-10 bg-accent" />
                        <div className="w-px h-6 bg-accent/50 mt-2.5" />
                        <span
                          className="num text-[9px] text-accent absolute top-0 -translate-x-1/2 whitespace-nowrap"
                          style={{ transform: `translateX(-50%) rotate(-42deg)`, transformOrigin: 'bottom left' }}
                        >
                          {site.enzyme}
                        </span>
                        <span className="num text-[9px] text-muted absolute top-[74px] -translate-x-1/2">
                          {site.position}
                        </span>
                      </div>
                    );
                  })}
                  <span className="num text-[10px] text-muted absolute right-0 top-[54px]">
                    {formatNumber(seq.length)} bp
                  </span>
                </div>
                {sites.length === 0 && <Notice>{t('gel.nosites')}</Notice>}
              </Panel>

              {/* --------------------------------------------------- the gel */}
              <div className="grid gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
                <Panel title={t('gel.lane')}>
                  <div
                    key={runId}
                    className="relative rounded-[3px] overflow-hidden"
                    style={{
                      height: GEL_HEIGHT,
                      background: 'linear-gradient(180deg, #0d1512 0%, #0a100e 100%)',
                      border: '1px solid var(--line)'
                    }}
                  >
                    {/* wells */}
                    {[0, 1].map(lane => (
                      <div
                        key={lane}
                        className="absolute rounded-[2px]"
                        style={{
                          left: 18 + lane * (LANE_WIDTH + 26),
                          top: 12, width: LANE_WIDTH, height: 9,
                          background: '#050807', border: '1px solid #1d2a25'
                        }}
                      />
                    ))}

                    {/* ladder */}
                    {ladder.map((size, i) => (
                      <div key={`L${size}`} className="absolute" style={{ left: 18, top: bandY(size) }}>
                        <div
                          className="rounded-[1px]"
                          style={{
                            width: LANE_WIDTH,
                            height: 3,
                            background: '#7f8f88',
                            boxShadow: '0 0 6px rgba(160,180,170,.5)',
                            animation: `migrate .9s cubic-bezier(.2,.7,.3,1) both`,
                            animationDelay: `${i * 45}ms`
                          }}
                        />
                        <span className="num absolute -left-1 -translate-x-full text-[9px] text-muted whitespace-nowrap"
                              style={{ top: -4 }}>
                          {size >= 1000 ? `${size / 1000}k` : size}
                        </span>
                      </div>
                    ))}

                    {/* sample */}
                    {fragments.map((fragment, i) => {
                      const intensity = Math.min(0.35 + fragment.length / (seq.length || 1), 1);
                      return (
                        <div
                          key={`F${i}`}
                          className="absolute rounded-[1px] group"
                          style={{
                            left: 18 + LANE_WIDTH + 26,
                            top: bandY(fragment.length),
                            width: LANE_WIDTH,
                            height: 3 + intensity * 3,
                            background: `rgba(158,230,75,${0.45 + intensity * 0.5})`,
                            boxShadow: `0 0 ${6 + intensity * 8}px rgba(158,230,75,${0.35 + intensity * 0.4})`,
                            animation: 'migrate 1.1s cubic-bezier(.2,.7,.3,1) both',
                            animationDelay: `${300 + i * 60}ms`
                          }}
                          title={`${fragment.length} bp`}
                        >
                          <span className="num absolute left-full ml-2 text-[9px] text-accent/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ top: -4 }}>
                            {formatNumber(fragment.length)}
                          </span>
                        </div>
                      );
                    })}

                    <span className="num absolute bottom-2 left-[18px] text-[9px] text-muted">{t('gel.ladder')}</span>
                    <span className="num absolute bottom-2 text-[9px] text-accent"
                          style={{ left: 18 + LANE_WIDTH + 26 }}>
                      {sites.length ? t('gel.fragments') : t('gel.uncut')}
                    </span>
                  </div>
                  <p className="label mt-3">{agarose}% {t('gel.agarose')} · {topology}</p>
                </Panel>

                <Panel title={t('gel.fragments')}>
                  <div className="scroll-thin overflow-auto" style={{ maxHeight: GEL_HEIGHT }}>
                    <table className="w-full text-[13px]">
                      <thead className="sticky top-0 bg-bg2">
                        <tr className="border-b border-line">
                          {['#', t('seq.orf.start'), t('seq.orf.end'), t('gel.bp'), t('gel.enzymes')].map(h => (
                            <th key={h} className="label text-left py-2 font-normal">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fragments.map((fragment, i) => (
                          <tr key={i} className="border-b border-linesoft">
                            <td className="py-2 num text-muted">{i + 1}</td>
                            <td className="py-2 num">{formatNumber(fragment.start)}</td>
                            <td className="py-2 num">{formatNumber(fragment.end)}</td>
                            <td className="py-2 num text-accent">{formatNumber(fragment.length)}</td>
                            <td className="py-2 num text-[11px] text-muted">
                              {fragment.leftEnzyme ?? '—'} / {fragment.rightEnzyme ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              {sites.length > 0 && (
                <Panel title={t('gel.sites')}>
                  <div className="flex flex-wrap gap-2">
                    {sites.map((site, i) => (
                      <span key={i} className="chip">
                        <span className="text-accent">{site.enzyme}</span>
                        <span className="ml-2 text-muted">{formatNumber(site.position)}</span>
                      </span>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          )}
        </div>
      </div>
    </ToolShell>
  );
}
