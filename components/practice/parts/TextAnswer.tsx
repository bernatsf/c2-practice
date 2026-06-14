"use client";

import { useEffect, useRef } from "react";

// Shared single-line answer input for Parts 2, 3 and 4.
export function TextAnswer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  // Auto-focus on mount and whenever it becomes editable again (next question).
  useEffect(() => {
    if (!disabled) ref.current?.focus();
  }, [disabled]);

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      disabled={disabled}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        // The submit Enter must die here at the input and never reach the
        // global "Enter advances" listener in PracticeSession — otherwise the
        // same keypress that submits would also fire next() and wipe the
        // feedback. preventDefault + stopPropagation kill the bubble. A fresh
        // Enter pressed afterwards (when this input is disabled and no longer
        // receives key events) still reaches the window listener and advances.
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled && value.trim()) onSubmit();
        }
      }}
      className="w-full rounded-md border border-border bg-panel2 px-4 py-3 font-mono text-lg outline-none focus:border-accent disabled:opacity-70"
    />
  );
}
