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
        if (e.key === "Enter" && !disabled && value.trim()) onSubmit();
      }}
      className="w-full rounded-md border border-border bg-panel2 px-4 py-3 font-mono text-lg outline-none focus:border-accent disabled:opacity-70"
    />
  );
}
