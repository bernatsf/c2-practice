"use client";

import type { Question } from "@/lib/types";

// Post-submission reveal for the free-text parts (2, 3, 4).
//
// Text inputs cannot signal the right answer the way Part 1's multiple-choice
// buttons do (turning green), so the reveal renders UNCONDITIONALLY the moment
// the question is revealed (disabled) — whether the user was right or wrong.
// This guarantees they always see the correct answer and explanation inline.
//
// The answer text is read directly off the question object (q.answers), NOT
// from the async grade result. Coupling it to the grade result was fragile:
// state batching / stale closures could leave the result null on the render
// where `disabled` flips true, silently rendering nothing. Reading the static
// question data removes that timing dependency entirely.
export function InlineReveal({ q, disabled }: { q: Question; disabled: boolean }) {
  if (!disabled) return null;

  const answer = q.answers.join("  /  ");

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
