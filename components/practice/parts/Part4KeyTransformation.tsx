"use client";

import type { Question } from "@/lib/types";
import { GapText } from "@/components/practice/GapText";
import { TextAnswer } from "./TextAnswer";
import { InlineReveal } from "./InlineReveal";

export function Part4KeyTransformation({
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
  const min = q.minWords ?? 3;
  const max = q.maxWords ?? 8;
  return (
    <div>
      <p className="text-base text-muted">{q.leadSentence}</p>
      <div className="my-3">
        <span className="rounded bg-panel2 px-3 py-1 font-mono text-sm font-semibold uppercase tracking-widest text-accent">
          {q.keyWord}
        </span>
      </div>
      <p className="text-lg leading-relaxed">
        <GapText text={q.gapped ?? ""} />
      </p>
      <p className="mt-1 text-xs text-muted">
        Use {min}–{max} words including <strong>{q.keyWord}</strong>. Do not change the key word.
        Type only the words for the gap.
      </p>
      <div className="mt-4">
        <TextAnswer
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          disabled={disabled}
          placeholder="gap fill…"
        />
      </div>

      <InlineReveal q={q} disabled={disabled} />
    </div>
  );
}
