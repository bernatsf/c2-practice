"use client";

import type { Question } from "@/lib/types";
import { GapText } from "@/components/practice/GapText";
import { TextAnswer } from "./TextAnswer";

export function Part2OpenCloze({
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
    </div>
  );
}
