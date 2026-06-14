"use client";

import type { Question } from "@/lib/types";
import { normalize } from "@/lib/grading";
import { GapText } from "@/components/practice/GapText";
import { TextAnswer } from "./TextAnswer";

export function Part3WordFormation({
  q,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  q: Question;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  // On a correct answer the shared FeedbackBar stays silent, so reveal the
  // answer + explanation inline here. On an incorrect answer FeedbackBar
  // already shows both, so we don't duplicate it.
  const isCorrect = q.answers.some((a) => normalize(a) === normalize(value));

  return (
    <div>
      <p className="text-lg leading-relaxed">
        <GapText text={q.context ?? ""} />
      </p>
      <p className="mt-2 text-sm text-muted">
        Form a word from:{" "}
        <span className="rounded bg-panel2 px-2 py-0.5 font-mono uppercase tracking-wide text-ink">
          {q.rootWord}
        </span>
      </p>
      <div className="mt-4">
        <TextAnswer
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={disabled}
          placeholder="transformed word…"
        />
      </div>

      {/* Post-submission reveal: mirror Part 1 — show the correct answer and
          explanation once the question is revealed (disabled). */}
      {disabled && isCorrect && (
        <div className="mt-4">
          <div className="rounded-md border border-ok bg-ok/10 px-3 py-2 text-sm">
            <span className="text-muted">Answer: </span>
            <span className="font-mono text-ink">{q.answers.join("  /  ")}</span>
          </div>
          {q.explanation && (
            <p className="mt-2 text-sm text-muted">{q.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
