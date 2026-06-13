export function RatingSparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="h-12 text-xs text-muted">Not enough data yet.</div>;
  }
  const w = 240;
  const h = 48;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const up = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={up ? "#2fbf71" : "#ff5d5d"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
