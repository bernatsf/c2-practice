"use client";

import { useEffect } from "react";
import type { Question } from "@/lib/types";
import { GapText } from "@/components/practice/GapText";

export function Part1MultipleChoice({
  q,
  disabled,
  selected,
  onSelect,
}: {
  q: Question;
  disabled: boolean;
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  // Keyboard 1–4 select options.
  useEffect(() => {
    if (disabled) return;
    const handler = (e: KeyboardEvent) => {
      const idx = parseInt(e.key, 10) - 1;
      if (q.options && idx >= 0 && idx < q.options.length) {
        onSelect(q.options[idx].key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [q, disabled, onSelect]);

  const correctKey = q.answers[0];

  return (
    <div>
      <p className="text-lg leading-relaxed">
        <GapText text={q.context ?? ""} />
      </p>
      <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {q.options?.map((o, i) => {
          const isSel = selected === o.key;
          const isCorrect = o.key === correctKey;
          let cls = "border-border bg-panel2 hover:border-accent/50";
          if (disabled) {
            if (isCorrect) cls = "border-ok bg-ok/10";
            else if (isSel) cls = "border-bad bg-bad/10";
            else cls = "border-border bg-panel2 opacity-60";
          } else if (isSel) {
            cls = "border-accent bg-accent/10";
          }
          return (
            <button
              key={o.key}
              disabled={disabled}
              onClick={() => onSelect(o.key)}
              className={`flex items-center gap-3 rounded-md border px-3 py-3 text-left text-sm transition ${cls}`}
            >
              <span className="font-mono text-xs text-muted">{i + 1}</span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
