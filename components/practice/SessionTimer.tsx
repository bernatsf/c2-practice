"use client";

// A slim countdown bar + numeric seconds. Turns amber then red as time runs low.
export function SessionTimer({
  remainingMs,
  durationMs,
  label,
}: {
  remainingMs: number;
  durationMs: number;
  label: string;
}) {
  const frac = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const secs = Math.ceil(remainingMs / 1000);
  const tone = frac > 0.5 ? "bg-accent" : frac > 0.2 ? "bg-warn" : "bg-bad";
  const textTone = frac > 0.5 ? "text-muted" : frac > 0.2 ? "text-warn" : "text-bad";

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="uppercase tracking-wider text-muted">{label}</span>
        <span className={`font-mono tabular-nums ${textTone}`}>
          {secs}s
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
        <div
          className={`h-full ${tone} transition-[width] duration-100 ease-linear`}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
    </div>
  );
}
