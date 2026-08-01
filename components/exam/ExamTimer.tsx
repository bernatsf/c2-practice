"use client";

// The exam clock. Unlike the practice SessionTimer (which counts a handful of
// seconds and prints "37s"), this runs for 45 minutes, so it formats as mm:ss
// and sticks to the top of the viewport while the candidate scrolls.
export function ExamTimer({
  remainingMs,
  durationMs,
}: {
  remainingMs: number;
  durationMs: number;
}) {
  const frac = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const totalSecs = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;

  // Amber inside the last 10 minutes, red inside the last 2.
  const urgent = remainingMs <= 120_000;
  const low = remainingMs <= 600_000;
  const bar = urgent ? "bg-bad" : low ? "bg-warn" : "bg-accent";
  const text = urgent ? "text-bad" : low ? "text-warn" : "text-ink";

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-muted">Time remaining</span>
        <span className={`font-mono text-2xl font-semibold tabular-nums ${text}`}>
          {mins}:{String(secs).padStart(2, "0")}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
        <div
          className={`h-full ${bar} transition-[width] duration-200 ease-linear`}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
    </div>
  );
}
