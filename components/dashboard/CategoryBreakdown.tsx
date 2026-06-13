import type { CategoryStat } from "@/lib/types";
import { CATEGORY_LABEL } from "@/components/labels";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function accTone(acc: number): string {
  if (acc >= 0.85) return "text-ok";
  if (acc >= 0.6) return "text-warn";
  return "text-bad";
}

export function CategoryBreakdown({ categories }: { categories: CategoryStat[] }) {
  return (
    <div className="rounded-lg border border-border bg-panel">
      <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-wider text-muted">
        Performance by category · weakest first
      </div>
      {categories.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted">
          No attempts logged yet. Start a session to populate the breakdown.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 text-right font-medium">Attempts</th>
              <th className="px-4 py-2 text-right font-medium">Rolling acc.</th>
              <th className="px-4 py-2 text-right font-medium">Avg time</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.category} className="border-t border-border/60">
                <td className="px-4 py-2">{CATEGORY_LABEL[c.category] ?? c.category}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-muted">
                  {c.correct}/{c.attempts}
                </td>
                <td className={`px-4 py-2 text-right font-mono tabular-nums ${accTone(c.rollingAcc)}`}>
                  {pct(c.rollingAcc)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-muted">
                  {(c.avgResponseMs / 1000).toFixed(1)}s
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
