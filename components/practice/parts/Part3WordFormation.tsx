"use client";

import type { GradeResult, Question } from "@/lib/types";
import { GapText } from "@/components/practice/GapText";
import { TextAnswer } from "./TextAnswer";
import { InlineReveal } from "./InlineReveal";

export function Part3WordFormation({
  q,
  value,
  result,
  onChange,
  onSubmit,
  disabled,
}: {
  q: Question;
  value: string;
  result: GradeResult | null;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
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

      <InlineReveal q={q} disabled={disabled} result={result} />
    </div>
  );
}
