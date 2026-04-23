interface MiniSparkProps {
  data: number[];
  height?: number;
  color?: string;
  todayIdx?: number | null;
  gradientId?: string;
}

let counter = 0;

/** Inline SVG sparkline, used in stat cards and hero. */
export default function MiniSpark({
  data,
  height = 36,
  color = 'var(--accent)',
  todayIdx = null,
  gradientId,
}: MiniSparkProps) {
  if (data.length === 0) {
    return <svg viewBox="0 0 100 36" className="spark" aria-hidden="true" />;
  }

  const w = 100;
  const h = height;
  const max = Math.max(...data, 1);
  const denom = data.length > 1 ? data.length - 1 : 1;
  const step = w / denom;
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`)
    .join(' ');
  const area = `0,${h} ${points} ${w},${h}`;
  const gid = gradientId ?? `mini-spark-${counter++}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="spark"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {todayIdx != null && data[todayIdx] != null && (
        <circle
          cx={todayIdx * step}
          cy={h - (data[todayIdx] / max) * (h - 4) - 2}
          r="2.4"
          fill={color}
          stroke="var(--bg-1)"
          strokeWidth="1.4"
        />
      )}
    </svg>
  );
}
