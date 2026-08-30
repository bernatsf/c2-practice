"use client";

import type { RootFilter } from "@/lib/phrasal";
import { PHRASAL_BANK, PHRASAL_ROOTS } from "@/lib/phrasal";

// Item count per root, computed once at module load — the bank is static.
const COUNT_BY_ROOT: Record<string, number> = PHRASAL_BANK.reduce<Record<string, number>>(
  (acc, pv) => {
    acc[pv.root] = (acc[pv.root] ?? 0) + 1;
    return acc;
  },
  {}
);

/**
 * Root Matrix — drill the whole bank or narrow to one root verb.
 *
 * Each pill shows how many verbs the root holds, and a warn-coloured badge when
 * some of them are due for review, so a learner can see where their lapses are
 * concentrated before choosing. Roots with nothing due show no badge rather
 * than a zero, which would be noise across 24 pills.
 */
export function RootMatrix({
  selected,
  dueByRoot,
  onSelect,
}: {
  selected: RootFilter;
  dueByRoot: Record<string, number>;
  onSelect: (root: RootFilter) => void;
}) {
  const pill = (value: RootFilter, label: string, total: number) => {
    const active = value === selected;
    const dueHere = value === "all" ? 0 : (dueByRoot[value] ?? 0);
    return (
      <button
        key={String(value)}
        type="button"
        onClick={() => onSelect(value)}
        aria-pressed={active}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition ${
          active
            ? "border-accent bg-accent/15 text-ink"
            : "border-border bg-panel2 text-muted hover:border-accent/50 hover:text-ink"
        }`}
      >
        {label}
        <span className={`ml-1.5 tabular-nums ${active ? "text-ink/60" : "text-muted/60"}`}>
          {total}
        </span>
        {dueHere > 0 && (
          <span className="ml-1.5 rounded-full bg-warn/20 px-1.5 tabular-nums text-warn">
            {dueHere}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="mb-5 rounded-lg border border-border bg-panel p-3">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted">Root matrix</div>
      <div className="flex flex-wrap gap-1.5">
        {pill("all", "All roots", PHRASAL_BANK.length)}
        {PHRASAL_ROOTS.map((root) => pill(root, root, COUNT_BY_ROOT[root] ?? 0))}
      </div>
    </div>
  );
}
