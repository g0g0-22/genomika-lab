/**
 * The one piece of imagery on the site: a double helix drawn as two phase-
 * shifted sine curves with base-pair rungs. Rendered in a narrow sage range
 * rather than in nucleotide colours, so it reads as a photograph of a model
 * rather than as a diagram — depth comes from scale and opacity, not hue.
 */
export function Helix({ turns = 3, rungs = 52, height = 520, className = '' }: {
  turns?: number; rungs?: number; height?: number; className?: string;
}) {
  const width = 220;
  const amplitude = width / 2 - 30;
  const centre = width / 2;

  const at = (t: number, phase: number) => {
    const y = t * height;
    const angle = t * turns * Math.PI * 2 + phase;
    return { x: centre + Math.sin(angle) * amplitude, y, depth: (Math.cos(angle) + 1) / 2 };
  };

  const strand = (phase: number) =>
    Array.from({ length: 180 }, (_, i) => {
      const p = at(i / 179, phase);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ');

  // Four closely-related sage tones; which one a bead takes is deterministic.
  const TONES = ['#7E9C84', '#A8BFAC', '#C9D8C9', '#90A896'];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="bead" cx="34%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".9" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path d={strand(0)} fill="none" stroke="var(--line-firm)" strokeWidth="1" strokeOpacity=".7" />
      <path d={strand(Math.PI)} fill="none" stroke="var(--line-firm)" strokeWidth="1" strokeOpacity=".7" />

      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const left = at(t, 0);
        const right = at(t, Math.PI);
        const tone = TONES[i % TONES.length];
        const pairTone = TONES[(i + 2) % TONES.length];
        return (
          <g key={i} className="fade" style={{ animationDelay: `${i * 22}ms`, animationDuration: '1.1s' }}>
            <line
              x1={left.x} y1={left.y} x2={right.x} y2={right.y}
              stroke="var(--line-firm)"
              strokeWidth={0.7 + left.depth * 0.5}
              strokeOpacity={0.3 + left.depth * 0.35}
            />
            {[{ p: left, c: tone }, { p: right, c: pairTone }].map((bead, k) => {
              const r = 3.2 + bead.p.depth * 4.4;
              return (
                <g key={k}>
                  <circle cx={bead.p.x} cy={bead.p.y} r={r} fill={bead.c} opacity={0.42 + bead.p.depth * 0.5} />
                  <circle cx={bead.p.x} cy={bead.p.y} r={r} fill="url(#bead)" opacity={0.55 + bead.p.depth * 0.4} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
