import { useId, useRef, useState, type ReactNode } from 'react';

/**
 * Small inline-SVG chart set.
 *
 * Colour rules follow one convention throughout: a single-series chart uses the
 * interface accent, and multi-series charts use the three validated categorical
 * colours in a fixed order that never depends on rank or on how many series are
 * currently visible.
 */

export const SERIES = ['var(--s-green)', 'var(--s-blue)', 'var(--s-rose)'];

type Point = { label: string; value: number; color?: string; meta?: string };

/* ------------------------------------------------------------- TOOLTIP -- */

function useTooltip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const show = (event: React.MouseEvent, content: ReactNode) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: event.clientX - box.left, y: event.clientY - box.top, content });
  };
  const node = tip ? (
    <div
      className="pointer-events-none absolute z-20 card px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-lg"
      style={{
        left: Math.min(Math.max(tip.x, 6), (ref.current?.clientWidth ?? 300) - 8),
        top: Math.max(tip.y - 44, 0),
        transform: 'translateX(-50%)'
      }}
      role="tooltip"
    >
      {tip.content}
    </div>
  ) : null;
  return { ref, show, hide: () => setTip(null), node };
}

/* ----------------------------------------------------------- BAR CHART -- */

export function BarChart({ data, height = 200, valueSuffix = '', color = 'var(--accent)' }: {
  data: Point[]; height?: number; valueSuffix?: string; color?: string;
}) {
  const { ref, show, hide, node } = useTooltip();
  const max = Math.max(...data.map(d => d.value), 1);
  const gap = 2;

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-end gap-[2px]" style={{ height }} onMouseLeave={hide}>
        {data.map((d, i) => {
          const h = Math.max((d.value / max) * (height - 26), 2);
          return (
            <div key={d.label + i} className="flex-1 flex flex-col justify-end items-center min-w-0 group">
              <span className="num text-[10px] mb-1 text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                {d.value}
              </span>
              <div
                className="w-full rounded-t-[4px] transition-[filter] hover:brightness-125 cursor-default"
                style={{ height: h, background: d.color ?? color, marginInline: gap / 2 }}
                onMouseMove={(e) => show(e, <><b className="num">{d.value}{valueSuffix}</b> · {d.label}</>)}
                role="img"
                aria-label={`${d.label}: ${d.value}${valueSuffix}`}
              />
              <span className="num text-[9px] mt-1.5 text-muted truncate w-full text-center">{d.label}</span>
            </div>
          );
        })}
      </div>
      {node}
    </div>
  );
}

/* ---------------------------------------------------------- LINE CHART -- */

export function LineChart({ data, height = 180, valueSuffix = '', color = 'var(--accent)' }: {
  data: Point[]; height?: number; valueSuffix?: string; color?: string;
}) {
  const { ref, show, hide, node } = useTooltip();
  const [active, setActive] = useState<number | null>(null);
  const gradientId = useId();
  const width = 700;
  const pad = { top: 14, right: 10, bottom: 26, left: 34 };
  const max = Math.max(...data.map(d => d.value), 1);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${pad.top + innerH} L${x(0).toFixed(1)},${pad.top + innerH} Z`;
  const ticks = [0, 0.5, 1].map(f => Math.round(max * f));

  return (
    <div className="relative" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => { hide(); setActive(null); }}
        onMouseMove={(e) => {
          const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const rel = ((e.clientX - box.left) / box.width) * width;
          const i = Math.round(((rel - pad.left) / innerW) * (data.length - 1));
          const clamped = Math.min(Math.max(i, 0), data.length - 1);
          setActive(clamped);
          show(e, <><b className="num">{data[clamped].value}{valueSuffix}</b> · {data[clamped].label}</>);
        }}
        role="img"
        aria-label={data.map(d => `${d.label}: ${d.value}`).join(', ')}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map(tick => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.left - 6} y={y(tick) + 3} textAnchor="end" className="num" fontSize="9" fill="var(--muted)">{tick}</text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity=".6" />
        )}

        {data.map((d, i) => (
          <circle
            key={d.label + i}
            cx={x(i)} cy={y(d.value)} r={active === i ? 5 : 3}
            fill={color} stroke="var(--paper)" strokeWidth="2"
          />
        ))}

        {data.map((d, i) => (
          (i === 0 || i === data.length - 1 || data.length <= 8) && (
            <text key={`l${i}`} x={x(i)} y={height - 8} textAnchor="middle" className="num" fontSize="9" fill="var(--muted)">
              {d.label}
            </text>
          )
        ))}
      </svg>
      {node}
    </div>
  );
}

/* ---------------------------------------------- HORIZONTAL BAR (RANKED) -- */

export function HBarChart({ data, valueSuffix = '' }: { data: Point[]; valueSuffix?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.label + i}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-[13px] text-ink2 truncate">{d.label}</span>
            <span className="num text-[13px] shrink-0">{d.value}{valueSuffix}</span>
          </div>
          <div className="h-2 bg-bg3 rounded-[4px] overflow-hidden">
            <div
              className="h-full rounded-[4px] transition-[width] duration-700"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? SERIES[i % SERIES.length] }}
            />
          </div>
          {d.meta && <div className="label mt-1">{d.meta}</div>}
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- DONUT -- */

export function Donut({ segments, size = 150, caption }: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  caption?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
           aria-label={segments.map(s => `${s.label}: ${s.value}`).join(', ')}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map(seg => {
            const fraction = seg.value / total;
            const dash = fraction * circumference;
            // A 2px gap between neighbouring arcs keeps the boundary readable.
            const el = (
              <circle
                key={seg.label}
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" stroke={seg.color} strokeWidth="14"
                strokeDasharray={`${Math.max(dash - 2, 0)} ${circumference - dash + 2}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" className="num" fontSize="20" fill="var(--ink)">
          {Math.round((segments[0]?.value / total) * 100)}%
        </text>
        {caption && (
          <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="8"
                fill="var(--muted)" letterSpacing="1.4" className="num">
            {caption.toUpperCase()}
          </text>
        )}
      </svg>
      <ul className="space-y-2">
        {segments.map(seg => (
          <li key={seg.label} className="flex items-center gap-2.5 text-[13px]">
            <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: seg.color }} aria-hidden="true" />
            <span className="text-ink2">{seg.label}</span>
            <span className="num text-muted">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- GANTT -- */

export type GanttRow = { label: string; start: string; end: string; color?: string; meta?: string };

export function Gantt({ rows, formatDate }: { rows: GanttRow[]; formatDate: (iso: string) => string }) {
  const { ref, show, hide, node } = useTooltip();
  const times = rows.flatMap(r => [new Date(r.start).getTime(), new Date(r.end).getTime()]);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = max - min || 1;
  const pct = (iso: string) => ((new Date(iso).getTime() - min) / span) * 100;

  const years: number[] = [];
  for (let y = new Date(min).getFullYear(); y <= new Date(max).getFullYear(); y++) years.push(y);
  const nowPct = pct(new Date().toISOString());

  return (
    <div className="relative" ref={ref} onMouseLeave={hide}>
      <div className="relative mb-2 h-4">
        {years.map(y => (
          <span key={y} className="num text-[9px] text-muted absolute -translate-x-1/2"
                style={{ left: `${pct(`${y}-01-01`)}%` }}>
            {y}
          </span>
        ))}
      </div>
      <div className="relative space-y-2.5">
        {years.map(y => (
          <span key={y} className="absolute top-0 bottom-0 w-px bg-line" style={{ left: `${pct(`${y}-01-01`)}%` }} aria-hidden="true" />
        ))}
        {nowPct >= 0 && nowPct <= 100 && (
          <span className="absolute top-0 bottom-0 w-px bg-accent/60 z-10" style={{ left: `${nowPct}%` }} aria-hidden="true" />
        )}
        {rows.map((r, i) => (
          <div key={r.label + i} className="relative h-7 flex items-center">
            <div
              className="absolute h-3.5 rounded-[4px] cursor-default hover:brightness-125 transition-[filter]"
              style={{
                left: `${pct(r.start)}%`,
                width: `${Math.max(pct(r.end) - pct(r.start), 1)}%`,
                background: r.color ?? SERIES[i % SERIES.length]
              }}
              onMouseMove={(e) => show(e, <><b>{r.label}</b><br />{formatDate(r.start)} → {formatDate(r.end)}{r.meta ? <> · {r.meta}</> : null}</>)}
              role="img"
              aria-label={`${r.label}: ${formatDate(r.start)} – ${formatDate(r.end)}`}
            />
            <span className="absolute left-0 text-[11px] text-ink2 truncate max-w-[42%] pointer-events-none"
                  style={{ left: `calc(${pct(r.start)}% + 8px)`, opacity: pct(r.end) - pct(r.start) > 22 ? 0 : 1 }}>
            </span>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-1">
        {rows.map((r, i) => (
          <li key={`legend-${i}`} className="flex items-center gap-2.5 text-[12px] text-ink2">
            <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: r.color ?? SERIES[i % SERIES.length] }} aria-hidden="true" />
            <span className="truncate">{r.label}</span>
            {r.meta && <span className="label ml-auto shrink-0">{r.meta}</span>}
          </li>
        ))}
      </ul>
      {node}
    </div>
  );
}
