import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../i18n';
import { ToolShell, Panel, Metric } from '../../components/ToolShell';
import { SequenceInput } from '../../components/SequenceInput';
import { useDebounced } from '../../lib/useDebounced';
import { Toggle, Notice, download } from '../../components/ui';
import {
  ENZYMES, findCutSites, digest, recognitionSequence, migration, overhang,
  LADDER_1KB, LADDER_100BP, GEL_RANGES, type Enzyme
} from '../../lib/bio/enzymes';
import { cleanSequence, parseFasta, classifyInput, IUPAC_DNA_ALPHABET } from '../../lib/bio/sequence';
import { PLASMID_FRAGMENT } from '../../lib/bio/samples';

const GEL_HEIGHT = 380;
const LANE_WIDTH = 74;

export default function Gel() {
  const { t, formatNumber, tv } = useLang();
  const [raw, setRaw] = useState('');
  // Derived views are recomputed from this, not from every keystroke.
  const input = useDebounced(raw);
  const [selected, setSelected] = useState<string[]>(['EcoRI', 'BamHI', 'HindIII']);
  const [agarose, setAgarose] = useState('1.0');
  const [topology, setTopology] = useState('linear');
  const [runId, setRunId] = useState(0);

  // The first record only: joining records manufactured restriction sites
  // across the boundary between two unrelated sequences.
  const parsed = useMemo(() => parseFasta(input), [input]);
  const isProtein = parsed[0] ? classifyInput(parsed[0].seq) === 'protein' : false;
  // Degenerate codes are kept as they are: a restriction site can match them.
  const { seq, dropped } = useMemo(
    () => (isProtein ? { seq: '', dropped: 0 } : cleanSequence(parsed[0]?.seq ?? '', IUPAC_DNA_ALPHABET)),
    [parsed, isProtein]
  );

  const enzymes = useMemo(
    () => ENZYMES.filter(e => selected.includes(e.name)),
    [selected]
  );

  const sites = useMemo(
    () => (seq ? findCutSites(seq, enzymes, topology === 'circular') : []),
    [seq, enzymes, topology]
  );
  const fragments = useMemo(
    () => (seq ? digest(seq, sites, topology === 'circular') : []),
    [seq, sites, topology]
  );

  const [minBp, maxBp] = GEL_RANGES[agarose];

  // A gel only resolves a band of lengths. Anything shorter runs off the
  // front, anything longer never leaves the well — show both honestly rather
  // than clamping everything onto the same line.
  const inRange = (n: number) => n >= minBp && n <= maxBp;
  const ladder = (maxBp <= 4000 ? LADDER_100BP : LADDER_1KB).filter(inRange);
  const resolved = fragments.filter(f => inRange(f.length));
  const ranOff = fragments.filter(f => f.length < minBp);
  const stuck = fragments.filter(f => f.length > maxBp);

  const toggleEnzyme = (name: string) =>
    setSelected(list => (list.includes(name) ? list.filter(n => n !== name) : [...list, name]));

  const exportFragments = () => {
    const header = 'fragment,start,end,length_bp,left_enzyme,right_enzyme,wraps_origin\n';
    const body = fragments
      .map((f, i) => `${i + 1},${f.start},${f.end},${f.length},${f.leftEnzyme ?? ''},${f.rightEnzyme ?? ''},${f.wraps ? 'yes' : 'no'}`)
      .join('\n');
    download('digest-fragments.csv', header + body, 'text/csv');
  };

  const bandY = (length: number) => 26 + migration(length, minBp, maxBp) * (GEL_HEIGHT - 56);

  /*
   * Cut sites cluster — three enzymes inside the first 50 bases of an 800 bp
   * construct is normal. Labels are stacked onto as many rows as it takes so
   * no two overlap. The calculation uses the track's measured width: on a
   * phone the same two sites sit a third as far apart as on a desktop, and a
   * fixed width would let their labels collide there.
   */
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackPx, setTrackPx] = useState(760);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setTrackPx(Math.max(entry.contentRect.width, 1)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [seq, sites.length]);

  const tiers = useMemo(() => {
    const PX_PER_CHAR = 6.4;                 // 10 px label face, plus breathing room
    const lastEndOnTier: number[] = [];
    const of = sites.map(site => {
      const x = (site.position / Math.max(seq.length, 1)) * trackPx;
      const width = site.enzyme.length * PX_PER_CHAR + 8;
      let tier = lastEndOnTier.findIndex(end => x > end);
      if (tier === -1) tier = lastEndOnTier.length;
      lastEndOnTier[tier] = x + width;
      return tier;
    });
    return { of, count: Math.max(lastEndOnTier.length, 1) };
  }, [sites, seq.length, trackPx]);

  return (
    <ToolShell index="05.2 / GEL" name="tool.gel.name" desc="tool.gel.desc">
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
                    <span className="num text-muted tracking-wider ml-auto">{enzyme.site}</span>
                    <span className="label w-14 text-right">{overhang(enzyme) === 'blunt' ? t('gel.blunt') : overhang(enzyme)}</span>
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
                  ariaLabel={t('gel.topology')}
                  value={topology}
                  onChange={setTopology}
                  options={[
                    { value: 'linear', label: t('gel.linear') },
                    { value: 'circular', label: t('gel.circular') }
                  ]}
                />
              </div>
              <button className="btn btn-primary w-full justify-center" onClick={() => setRunId(n => n + 1)} disabled={!seq}>
                ↻ {t('gel.run')}
              </button>
            </div>
          </Panel>

          {seq && (
            <Panel title={t('common.results')}>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <Metric label={t('seq.length')} value={formatNumber(seq.length)} unit="bp" />
                <Metric label={t('gel.sites')} value={sites.length} />
                <Metric label={t('gel.fragments')} value={fragments.length} />
                <Metric label={t('gel.largest')} value={formatNumber(fragments[0]?.length ?? 0)} unit="bp" />
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
              onExample={() => {
                // A double digest whose four fragments all resolve on a 2 % gel,
                // so the example shows a gel rather than a list of run-off notes.
                setRaw(`>pGL-demo synthetic multiple cloning site\n${PLASMID_FRAGMENT}`);
                setSelected(['PvuII', 'NdeI']);
                setAgarose('2.0');
                setTopology('linear');
                setRunId(n => n + 1);
              }}
              records={parsed.length}
              firstId={parsed[0]?.id}
              protein={isProtein}
              dropped={dropped}
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
                {sites.length === 0 ? (
                  <Notice>{t('gel.nosites')}</Notice>
                ) : (
                  <div ref={trackRef} className="relative mt-2" style={{ height: 36 + tiers.count * 16 }}>
                    {/* the sequence itself */}
                    <div
                      className="absolute inset-x-0 h-[6px] bg-bg3 border border-line"
                      style={{ top: tiers.count * 16 + 6 }}
                    />

                    {sites.map((site, i) => {
                      const left = (site.position / seq.length) * 100;
                      const tier = tiers.of[i];
                      const labelTop = tier * 16;
                      const barTop = tiers.count * 16 + 6;
                      return (
                        <div key={i} className="absolute top-0" style={{ left: `${left}%` }}>
                          {/* leader from the label down to the cut */}
                          <div
                            className="absolute w-px bg-line"
                            style={{ top: labelTop + 12, height: barTop - labelTop - 12 }}
                          />
                          {/* the cut itself */}
                          <div className="absolute w-px bg-accent" style={{ top: barTop, height: 6 }} />
                          <span
                            className="absolute text-[10px] whitespace-nowrap text-ink2"
                            style={{ top: labelTop, left: 4 }}
                          >
                            {site.enzyme}
                          </span>
                          <span
                            className="absolute num text-[10.5px] text-muted whitespace-nowrap"
                            style={{ top: barTop + 10, left: 4 }}
                          >
                            {site.position}
                          </span>
                        </div>
                      );
                    })}

                    <span
                      className="num text-[10px] text-muted absolute right-0"
                      style={{ top: tiers.count * 16 + 16 }}
                    >
                      {formatNumber(seq.length)} bp
                    </span>
                  </div>
                )}
              </Panel>

              {/* --------------------------------------------------- the gel */}
              <div className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)] items-start">
                <Panel title={t('gel.lane')}>
                  <div
                    key={runId}
                    className="relative overflow-hidden"
                    style={{ height: GEL_HEIGHT, background: 'linear-gradient(180deg,#17181A 0%,#0E0F10 100%)' }}
                  >
                    {/* loading wells */}
                    {[0, 1].map(lane => (
                      <div
                        key={lane}
                        className="absolute"
                        style={{
                          left: 18 + lane * (LANE_WIDTH + 26),
                          top: 10, width: LANE_WIDTH, height: 7,
                          background: '#09090A', boxShadow: 'inset 0 0 0 1px #2A2C2E'
                        }}
                      />
                    ))}

                    {/* ladder */}
                    {ladder.map((size, i) => (
                      <div key={`L${size}`} className="absolute" style={{ left: 18, top: bandY(size) }}>
                        <div
                          style={{
                            width: LANE_WIDTH, height: 2,
                            background: '#8C8F90',
                            boxShadow: '0 0 4px rgba(190,195,195,.3)',
                            animation: 'migrate .9s cubic-bezier(.2,.7,.3,1) both',
                            animationDelay: `${i * 45}ms`
                          }}
                        />
                        <span className="num absolute -left-2 -translate-x-full text-[10.5px] text-white/75 whitespace-nowrap" style={{ top: -5 }}>
                          {size >= 1000 ? `${size / 1000}k` : size}
                        </span>
                      </div>
                    ))}

                    {/* sample — only what this gel resolves */}
                    {resolved.map((fragment, i) => {
                      const weight = Math.min(fragment.length / (seq.length || 1), 1);
                      return (
                        <div
                          key={`F${i}`}
                          className="absolute group"
                          style={{
                            left: 18 + LANE_WIDTH + 26,
                            top: bandY(fragment.length),
                            width: LANE_WIDTH,
                            height: 2.5 + weight * 3,
                            background: `rgba(206,222,208,${0.55 + weight * 0.4})`,
                            boxShadow: `0 0 ${5 + weight * 7}px rgba(168,191,172,${0.3 + weight * 0.3})`,
                            animation: 'migrate 1.1s cubic-bezier(.2,.7,.3,1) both',
                            animationDelay: `${300 + i * 60}ms`
                          }}
                          title={`${fragment.length} bp`}
                        >
                          <span className="num absolute left-full ml-2 text-[10.5px] text-white/85 whitespace-nowrap" style={{ top: -4 }}>
                            {formatNumber(fragment.length)}
                          </span>
                        </div>
                      );
                    })}

                    {/* the gel front: everything shorter has run past it */}
                    {ranOff.length > 0 && (
                      <div className="absolute inset-x-0" style={{ bottom: 20 }}>
                        <div style={{ height: 1, background: 'repeating-linear-gradient(90deg,#4A4D4E 0 5px,transparent 5px 10px)' }} />
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between gap-4 mt-3">
                    <span className="label">{t('gel.ladder')}</span>
                    <span className="label">{agarose}% {t('gel.agarose')} · {tv('gel', topology)}</span>
                  </div>

                  {(ranOff.length > 0 || stuck.length > 0) && (
                    <div className="mt-4">
                      <Notice>
                        {ranOff.length > 0 && (
                          <span className="block">
                            {t('gel.ranoff')} — <span className="num">{ranOff.map(f => f.length).join(', ')} bp</span>
                            {' '}&lt; {formatNumber(minBp)} bp
                          </span>
                        )}
                        {stuck.length > 0 && (
                          <span className="block mt-1">
                            {t('gel.stuck')} — <span className="num">{stuck.map(f => f.length).join(', ')} bp</span>
                            {' '}&gt; {formatNumber(maxBp)} bp
                          </span>
                        )}
                        <span className="block mt-1.5 text-muted">{t('gel.rangehint')}</span>
                      </Notice>
                    </div>
                  )}
                </Panel>

                <Panel title={t('gel.fragments')}>
                  <div className="scroll-thin overflow-auto">
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
                            <td className="py-2 num">
                              {formatNumber(fragment.end)}
                              {fragment.wraps && (
                                <span className="text-muted ml-1.5" title={t('gel.wraps')}>↩</span>
                              )}
                            </td>
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
