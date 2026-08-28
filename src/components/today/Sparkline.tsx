/** Міні-графік 110×40: акцентна ламана з крапкою на останній точці. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 110;
  const H = 40;
  const PAD = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = PAD + (i * (W - 2 * PAD)) / (values.length - 1);
    const y = H - PAD - ((v - min) / span) * (H - 2 * PAD);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block shrink-0" aria-hidden>
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={3} fill="var(--accent)" />
    </svg>
  );
}
