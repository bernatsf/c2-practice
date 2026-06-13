"use client";

import Link from "next/link";
import { CATEGORY_LABEL } from "@/components/labels";
import type { Category, Part } from "@/lib/types";

export function SessionHUD({
  modeLabel,
  part,
  category,
  index,
  streak,
  sessionCorrect,
  sessionCount,
  rating,
}: {
  modeLabel: string;
  part: Part;
  category: Category;
  index: number;
  streak: number;
  sessionCorrect: number;
  sessionCount: number;
  rating: number;
}) {
  const acc = sessionCount === 0 ? 0 : Math.round((sessionCorrect / sessionCount) * 100);
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted hover:text-ink">
          ← Dashboard
        </Link>
        <span className="text-muted">·</span>
        <span className="text-muted">{modeLabel}</span>
      </div>
      <div className="flex items-center gap-4 font-mono tabular-nums">
        <span className="rounded bg-panel2 px-2 py-0.5 text-xs text-muted">
          Part {part} · {CATEGORY_LABEL[category]}
        </span>
        <span className="text-muted">#{index}</span>
        <span className="text-muted">
          {sessionCorrect}/{sessionCount} ({acc}%)
        </span>
        <span title="streak">🔥 {streak}</span>
        <span className="text-accent">{rating}</span>
      </div>
    </div>
  );
}
