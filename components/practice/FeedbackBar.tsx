"use client";

import type { GradeResult, Question } from "@/lib/types";

// Instant binary feedback. No praise, no animation gate. Enter advances.
export function FeedbackBar({
  result,
  question,
  delta,
  onNext,
}: {
  result: GradeResult;
  question: Question;
  delta: number | null;
  onNext: () => void;
}) {
  const correct = result.correct;
  return (
    <div
      className={`mt-5 rounded-lg border p-4 ${
        correct ? "border-ok bg-ok/10" : "border-bad bg-bad/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`font-mono text-sm font-bold ${correct ? "text-ok" : "text-bad"}`}>
            {correct ? "CORRECT" : "INCORRECT"}
          </span>
          {delta !== null && (
            <span
              className={`font-mono text-sm tabular-nums ${
                delta >= 0 ? "text-ok" : "text-bad"
              }`}
            >
              {delta >= 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
        <button
          onClick={onNext}
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Next ↵
        </button>
      </div>

      {!correct && (
        <div className="mt-3 text-sm">
          <span className="text-muted">Answer: </span>
          <span className="font-mono text-ink">{result.accepted.join("  /  ")}</span>
        </div>
      )}

      {result.message && <div className="mt-1 text-xs text-warn">{result.message}</div>}

      {!correct && question.explanation && (
        <div className="mt-2 text-sm text-muted">{question.explanation}</div>
      )}
      {!correct && question.l1Note && (
        <div className="mt-1 text-xs text-warn/90">▸ {question.l1Note}</div>
      )}
    </div>
  );
}
