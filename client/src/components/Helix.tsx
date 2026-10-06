/**
 * The hero ornament: a double helix drawn as two phase-shifted sine curves with
 * base-pair rungs coloured by nucleotide. It carries the site's whole visual
 * argument — that the data is the decoration.
 */
export function Helix({ turns = 3.2, rungs = 46, height = 420, className = '' }: {
  turns?: number; rungs?: number; height?: number; className?: string;
}) {
  const width = 190;
  const amplitude = width / 2 - 22;
  const centre = width / 2;

  const pairs: [string, string][] = [['A', 'T'], ['T', 'A'], ['G', 'C'], ['C', 'G']];
  const COLOR: Record<string, string> = { A: '#35C77A', T: '#E8605D', G: '#E0A02F', C: '#4C9BF5' };

  const at = (t: number, phase: number) => {
    const y = t * height;
    const angle = t * turns * Math.PI * 2 + phase;
    return { x: centre + Math.sin(angle) * amplitude, y, depth: (Math.cos(angle) + 1) / 2 };
  };

  const strand = (phase: number) =>
    Array.from({ length: 160 }, (_, i) => {
      const p = at(i / 159, phase);
      return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const left = at(t, 0);
        const right = at(t, Math.PI);
        const [b1, b2] = pairs[i % pairs.length];
        const near = Math.max(left.depth, 1 - left.depth);
        return (
          <g key={i} className="fade" style={{ animationDelay: `${i * 26}ms`, animationDuration: '.9s' }}>
            <line
              x1={left.x} y1={left.y} x2={right.x} y2={right.y}
              stroke={COLOR[b1]}
              strokeWidth={1.1 + near * 1.5}
              strokeOpacity={0.24 + near * 0.5}
              strokeLinecap="round"
            />
            <circle cx={left.x} cy={left.y} r={1.4 + left.depth * 2} fill={COLOR[b1]} opacity={0.45 + left.depth * 0.55} />
            <circle cx={right.x} cy={right.y} r={1.4 + right.depth * 2} fill={COLOR[b2]} opacity={0.45 + right.depth * 0.55} />
          </g>
        );
      })}
      <path d={strand(0)} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeOpacity=".55" />
      <path d={strand(Math.PI)} fill="none" stroke="var(--s-blue)" strokeWidth="1.6" strokeOpacity=".55" />
    </svg>
  );
}
