"use client";

import type { GradeResult, Question } from "@/lib/types";
import { Part1MultipleChoice } from "./parts/Part1MultipleChoice";
import { Part2OpenCloze } from "./parts/Part2OpenCloze";
import { Part3WordFormation } from "./parts/Part3WordFormation";
import { Part4KeyTransformation } from "./parts/Part4KeyTransformation";

export function QuestionRenderer({
  q,
  disabled,
  value,
  result,
  onChange,
  onSubmit,
  onSelectOption,
}: {
  q: Question;
  disabled: boolean;
  value: string;
  result: GradeResult | null;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onSelectOption: (key: string) => void;
}) {
  switch (q.part) {
    case 1:
      return (
        <Part1MultipleChoice
          q={q}
          disabled={disabled}
          selected={value || null}
          onSelect={onSelectOption}
        />
      );
    case 2:
      return (
        <Part2OpenCloze q={q} value={value} result={result} onChange={onChange} onSubmit={onSubmit} disabled={disabled} />
      );
    case 3:
      return (
        <Part3WordFormation q={q} value={value} result={result} onChange={onChange} onSubmit={onSubmit} disabled={disabled} />
      );
    case 4:
      return (
        <Part4KeyTransformation q={q} value={value} result={result} onChange={onChange} onSubmit={onSubmit} disabled={disabled} />
      );
  }
}
