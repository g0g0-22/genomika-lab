import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../i18n';
import { accentVar } from './ui';

export type GraphNode = {
  id: string; kind: 'person' | 'project' | 'group';
  label_mk: string; label_en: string;
  accent?: string; hue?: number; seniority?: string; status?: string; weight: number;
};
export type GraphLink = { source: string; target: string; kind: string; weight: number };

type Sim = GraphNode & { x: number; y: number; vx: number; vy: number; fixed: boolean };

/**
 * A small force-directed layout.
 *
 * Three forces run each tick: nodes repel one another, linked nodes are pulled
 * together by a spring, and everything drifts gently toward the centre. It is
 * deliberately simple — the graph has under a hundred nodes.
 */
export function NetworkGraph({ nodes, links, height = 520 }: {
  nodes: GraphNode[]; links: GraphLink[]; height?: number;
}) {
  const { t, f } = useLang();
  const width = 900;
  const svgRef = useRef<SVGSVGElement>(null);
  const [sim, setSim] = useState<Sim[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const frame = useRef<number>(0);

  const index = useMemo(() => new Map(sim.map(n => [n.id, n])), [sim]);

  useEffect(() => {
    const seeded = nodes.map((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      const radius = node.kind === 'group' ? 60 : node.kind === 'project' ? 170 : 250;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0, vy: 0, fixed: false
      };
    });
    setSim(seeded);
  }, [nodes, height]);

  useEffect(() => {
    if (sim.length === 0) return;
    let alpha = 1;

    const tick = () => {
      setSim(current => {
        const next = current.map(n => ({ ...n }));
        const byId = new Map(next.map(n => [n.id, n]));

        // repulsion
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], b = next[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let distance = Math.hypot(dx, dy) || 0.01;
            if (distance > 320) continue;
            const force = (2600 / (distance * distance)) * alpha;
            dx /= distance; dy /= distance;
            a.vx -= dx * force; a.vy -= dy * force;
            b.vx += dx * force; b.vy += dy * force;
          }
        }

        // springs
        for (const link of links) {
          const a = byId.get(link.source), b = byId.get(link.target);
          if (!a || !b) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 0.01;
          const rest = link.kind === 'coauthor' ? 130 : 96;
          const force = ((distance - rest) * 0.012 * Math.min(link.weight, 4)) * alpha;
          const ux = dx / distance, uy = dy / distance;
          a.vx += ux * force; a.vy += uy * force;
          b.vx -= ux * force; b.vy -= uy * force;
        }

        // centring + integration
        for (const node of next) {
          if (node.fixed) { node.vx = 0; node.vy = 0; continue; }
          node.vx += (width / 2 - node.x) * 0.0022 * alpha;
          node.vy += (height / 2 - node.y) * 0.0022 * alpha;
          node.vx *= 0.82; node.vy *= 0.82;
          node.x = Math.min(Math.max(node.x + node.vx, 30), width - 30);
          node.y = Math.min(Math.max(node.y + node.vy, 26), height - 26);
        }
        return next;
      });

      alpha *= 0.994;
      if (alpha > 0.02) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.length, links]);

  const toSvg = (event: React.PointerEvent) => {
    const box = svgRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * width,
      y: ((event.clientY - box.top) / box.height) * height
    };
  };

  const onMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    const point = toSvg(event);
    setSim(current => current.map(n => (n.id === dragging ? { ...n, x: point.x, y: point.y, fixed: true } : n)));
  };

  const colorOf = (node: Sim) =>
    node.kind === 'group' ? accentVar(node.accent)
      : node.kind === 'project' ? 'var(--muted)'
      : `oklch(0.62 0.14 ${node.hue ?? 140})`;

  const radiusOf = (node: Sim) =>
    node.kind === 'group' ? 13 : node.kind === 'project' ? 8 : 6.5;

  const connected = useMemo(() => {
    if (!selected) return null;
    const set = new Set<string>([selected]);
    for (const link of links) {
      if (link.source === selected) set.add(link.target);
      if (link.target === selected) set.add(link.source);
    }
    return set;
  }, [selected, links]);

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none select-none"
        style={{ height }}
        onPointerMove={onMove}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
        role="img"
        aria-label={t('met.network')}
      >
        {links.map((link, i) => {
          const a = index.get(link.source), b = index.get(link.target);
          if (!a || !b) return null;
          const dim = connected && !(connected.has(link.source) && connected.has(link.target));
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={link.kind === 'coauthor' ? 'var(--accent)' : 'var(--line)'}
              strokeWidth={link.kind === 'coauthor' ? Math.min(0.6 + link.weight * 0.4, 3) : 1}
              strokeOpacity={dim ? 0.08 : link.kind === 'coauthor' ? 0.4 : 0.7}
            />
          );
        })}

        {sim.map(node => {
          const dim = connected && !connected.has(node.id);
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onPointerDown={e => { e.preventDefault(); setDragging(node.id); setSelected(node.id); }}
              onDoubleClick={() => setSim(c => c.map(n => (n.id === node.id ? { ...n, fixed: false } : n)))}
              style={{ cursor: 'grab', opacity: dim ? 0.22 : 1 }}
            >
              <circle
                r={radiusOf(node)}
                fill={colorOf(node)}
                stroke="var(--bg-2)"
                strokeWidth="2"
              />
              {(node.kind !== 'person' || selected === node.id || node.seniority === 'faculty') && (
                <text
                  x={radiusOf(node) + 6} y={4}
                  fontSize={node.kind === 'group' ? 12 : 10}
                  fill={node.kind === 'group' ? 'var(--ink)' : 'var(--ink2)'}
                  className="font-mono pointer-events-none"
                >
                  {f(node, 'label').length > 32 ? `${f(node, 'label').slice(0, 30)}…` : f(node, 'label')}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
        {([
          ['met.node.group', 'var(--accent)', 12],
          ['met.node.person', 'oklch(0.62 0.14 140)', 8],
          ['met.node.project', 'var(--muted)', 9]
        ] as const).map(([key, color, size]) => (
          <span key={key} className="flex items-center gap-2 text-[11px] text-ink2">
            <span className="rounded-full" style={{ width: size, height: size, background: color }} aria-hidden="true" />
            {t(key)}
          </span>
        ))}
        {selected && (
          <button className="btn btn-sm ml-auto" onClick={() => setSelected(null)}>{t('common.clear')}</button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- PARTNER MAP */

export type Partner = { id: number; name: string; city: string; country: string; lat: number; lng: number; joint_papers: number };

/** Equirectangular projection over the region the partners actually occupy. */
export function PartnerMap({ partners, height = 420 }: { partners: Partner[]; height?: number }) {
  const { t } = useLang();
  const width = 760;
  const [hover, setHover] = useState<number | null>(null);

  const lats = partners.map(p => p.lat);
  const lngs = partners.map(p => p.lng);
  const bounds = {
    minLat: Math.min(...lats) - 3, maxLat: Math.max(...lats) + 3,
    minLng: Math.min(...lngs) - 4, maxLng: Math.max(...lngs) + 4
  };

  const x = (lng: number) => ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - 60) + 30;
  const y = (lat: number) => (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - 60) + 30;

  const home = partners.find(p => p.city === 'Skopje');
  const maxPapers = Math.max(...partners.map(p => p.joint_papers), 1);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}
           role="img" aria-label={t('met.map')}>
        {/* graticule */}
        {Array.from({ length: 7 }, (_, i) => bounds.minLat + (i * (bounds.maxLat - bounds.minLat)) / 6).map(lat => (
          <g key={`lat${lat}`}>
            <line x1={20} x2={width - 20} y1={y(lat)} y2={y(lat)} stroke="var(--line)" strokeWidth="1" strokeDasharray="2 6" />
            <text x={6} y={y(lat) + 3} fontSize="8" fill="var(--muted)" className="num">{lat.toFixed(0)}°</text>
          </g>
        ))}
        {Array.from({ length: 7 }, (_, i) => bounds.minLng + (i * (bounds.maxLng - bounds.minLng)) / 6).map(lng => (
          <line key={`lng${lng}`} x1={x(lng)} x2={x(lng)} y1={20} y2={height - 20}
                stroke="var(--line)" strokeWidth="1" strokeDasharray="2 6" />
        ))}

        {/* links from the home institution */}
        {home && partners.filter(p => p.id !== home.id).map(partner => (
          <path
            key={`link${partner.id}`}
            d={`M${x(home.lng)},${y(home.lat)} Q${(x(home.lng) + x(partner.lng)) / 2},${(y(home.lat) + y(partner.lat)) / 2 - 40} ${x(partner.lng)},${y(partner.lat)}`}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={0.5 + (partner.joint_papers / maxPapers) * 1.8}
            strokeOpacity={hover === null || hover === partner.id ? 0.35 : 0.08}
          />
        ))}

        {partners.map(partner => {
          const radius = 4 + (partner.joint_papers / maxPapers) * 8;
          const isHome = partner.id === home?.id;
          return (
            <g key={partner.id}
               onMouseEnter={() => setHover(partner.id)}
               onMouseLeave={() => setHover(null)}
               style={{ cursor: 'default' }}>
              <circle
                cx={x(partner.lng)} cy={y(partner.lat)} r={radius}
                fill={isHome ? 'var(--accent)' : 'var(--s-blue)'}
                fillOpacity={hover === null || hover === partner.id ? 0.85 : 0.3}
                stroke="var(--bg-2)" strokeWidth="1.5"
              />
              {(isHome || hover === partner.id) && (
                <text
                  x={x(partner.lng) + radius + 5} y={y(partner.lat) + 3}
                  fontSize="10" fill="var(--ink)" className="font-mono"
                >
                  {partner.city} · {partner.joint_papers}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div className="card p-3 absolute bottom-2 left-2 text-[12px]">
          {(() => {
            const partner = partners.find(p => p.id === hover)!;
            return (
              <>
                <b>{partner.name}</b>
                <span className="block text-muted mt-0.5">{partner.city}, {partner.country}</span>
                <span className="block num text-accent mt-1">{partner.joint_papers} {t('met.jointpapers')}</span>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
