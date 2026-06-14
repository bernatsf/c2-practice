"use client";

import type { GradeResult, Question } from "@/lib/types";

// Post-submission reveal for the free-text parts (2, 3, 4).
//
// On an INCORRECT answer the shared FeedbackBar already prints the accepted
// answer and the explanation, so we render nothing here to avoid duplication.
// On a CORRECT answer FeedbackBar stays silent (just "CORRECT" + delta), which
// previously left the user blind — so we force the answer + explanation inline.
//
// Correctness comes from the authoritative grade result (not a re-derivation
// from the input), so the reveal can never disagree with how the answer was
// actually graded.
export function InlineReveal({
  q,
  disabled,
  result,
}: {
  q: Question;
  disabled: boolean;
  result: GradeResult | null;
}) {
  if (!disabled || !result || !result.correct) return null;

  const answer = result.accepted.length ? result.accepted.join("  /  ") : q.answers.join("  /  ");

  return (
    <div className="mt-4">
      <div className="rounded-md border border-ok bg-ok/10 px-3 py-2 text-sm">
        <span className="text-muted">Answer: </span>
        <span className="font-mono text-ink">{answer}</span>
      </div>
      {q.explanation && <p className="mt-2 text-sm text-muted">{q.explanation}</p>}
    </div>
  );
}
