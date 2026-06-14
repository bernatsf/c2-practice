"use client";

import type { GradeResult, Question } from "@/lib/types";

// Post-submission reveal for the free-text parts (2, 3, 4).
//
// Text inputs cannot signal the right answer the way Part 1's multiple-choice
// buttons do (turning green), so the reveal renders UNCONDITIONALLY the moment
// the question is revealed (disabled) — whether the user was right or wrong.
// This guarantees they always see the accepted answer and explanation inline.
//
// The accepted answer comes from the authoritative grade result when present
// (falling back to the question's own answers), so the reveal can never
// disagree with how the answer was actually graded.
export function InlineReveal({
  q,
  disabled,
  result,
}: {
  q: Question;
  disabled: boolean;
  result: GradeResult | null;
}) {
  if (!disabled) return null;

  const answer =
    result && result.accepted.length ? result.accepted.join("  /  ") : q.answers.join("  /  ");

  return (
    <div className="mt-4">
      <div className="rounded-md border border-border bg-panel2 px-3 py-2 text-sm">
        <span className="text-muted">Answer: </span>
        <span className="font-mono text-ink">{answer}</span>
      </div>
      {q.explanation && <p className="mt-2 text-sm text-muted">{q.explanation}</p>}
    </div>
  );
}
