export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "ok" | "bad" | "accent";
}) {
  const toneClass =
    tone === "ok"
      ? "text-ok"
      : tone === "bad"
      ? "text-bad"
      : tone === "accent"
      ? "text-accent"
      : "text-ink";
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}
