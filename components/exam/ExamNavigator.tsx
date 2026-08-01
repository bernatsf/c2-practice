"use client";

import type { Question } from "@/lib/types";
import { EXAM_BLUEPRINT } from "@/lib/exam";

// Question palette: every item on the paper as a numbered square, grouped into
// one labelled row per part. Answered items are filled, the current item is
// ringed — so the candidate can see at a glance what is still blank and jump
// straight there.
export function ExamNavigator({
  paper,
  answers,
  index,
  onGoTo,
}: {
  paper: Question[];
  answers: Record<string, string>;
  index: number;
  onGoTo: (i: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted">Question navigator</div>
      <div className="mt-3 space-y-3">
        {EXAM_BLUEPRINT.map((spec) => {
          // Positions are absolute within the paper, which is laid out in
          // blueprint order, so a filter preserves each item's real index.
          const entries = paper
            .map((q, i) => ({ q, i }))
            .filter(({ q }) => q.part === spec.part);
          if (entries.length === 0) return null;

          return (
            <div key={spec.part}>
              <div className="mb-1.5 text-xs text-muted">
                {spec.label}
                <span className="ml-2 text-border">·</span>
                <span className="ml-2">
                  {spec.marksPerQuestion} mark{spec.marksPerQuestion === 1 ? "" : "s"} each
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entries.map(({ q, i }, n) => {
                  const answered = (answers[q.id] ?? "").trim().length > 0;
                  const active = i === index;
                  let cls = answered
                    ? "border-accent/60 bg-accent/15 text-ink"
                    : "border-border bg-panel2 text-muted hover:text-ink";
                  if (active) cls += " ring-2 ring-accent ring-offset-1 ring-offset-panel";
                  return (
                    <button
                      key={q.id}
                      onClick={() => onGoTo(i)}
                      aria-label={`Go to ${spec.label}, question ${n + 1}`}
                      aria-current={active ? "true" : undefined}
                      className={`h-8 w-8 rounded border font-mono text-xs transition ${cls}`}
                    >
                      {n + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
