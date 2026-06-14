"use client";

import type { GradeResult, Question } from "@/lib/types";
import { GapText } from "@/components/practice/GapText";
import { TextAnswer } from "./TextAnswer";
import { InlineReveal } from "./InlineReveal";

export function Part2OpenCloze({
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
      <p className="mt-1 text-xs text-muted">Write ONE word in the gap.</p>
      <div className="mt-4">
        <TextAnswer
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={disabled}
          placeholder="one word…"
        />
      </div>

      <InlineReveal q={q} disabled={disabled} result={result} />
    </div>
  );
}
