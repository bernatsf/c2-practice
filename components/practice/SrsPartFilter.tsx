"use client";

import type { Part, PartDueCounts, PartFilter } from "@/lib/types";

const PARTS: Part[] = [1, 2, 3, 4];

// Part selector for the review queue. Pills wrap on narrow viewports rather
// than scrolling, so all five stay reachable on a phone.
//
// Empty parts stay enabled deliberately: dimming rather than disabling keeps the
// due count readable, and selecting one shows the "no due items" message, which
// is a clearer answer than a button that does nothing.
export function SrsPartFilter({
  selected,
  due,
  onSelect,
}: {
  selected: PartFilter;
  due: PartDueCounts;
  onSelect: (part: PartFilter) => void;
}) {
  const pill = (value: PartFilter, label: string) => {
    const active = value === selected;
    const count = due[value];
    return (
      <button
        key={String(value)}
        type="button"
        onClick={() => onSelect(value)}
        aria-pressed={active}
        className={`rounded-full border px-3 py-1.5 text-sm transition ${
          active
            ? "border-accent bg-accent/15 text-ink"
            : count === 0
              ? "border-border bg-panel2 text-muted/50 hover:text-muted"
              : "border-border bg-panel2 text-muted hover:border-accent/50 hover:text-ink"
        }`}
      >
        {label}
        <span className={`ml-1.5 text-xs ${active ? "text-ink/70" : "text-muted/70"}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="mb-4">
      <div className="mb-1.5 text-xs uppercase tracking-wider text-muted">Filter by part</div>
      <div className="flex flex-wrap gap-2">
        {pill("all", "All Parts")}
        {PARTS.map((p) => pill(p, `Part ${p}`))}
      </div>
    </div>
  );
}
