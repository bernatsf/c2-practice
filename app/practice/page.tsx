"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { SessionMode, TimerMode } from "@/lib/types";
import { PracticeSession } from "@/components/practice/PracticeSession";

const VALID: SessionMode[] = ["part1", "part2", "part3", "part4", "mixed", "srs"];

function parseTimer(raw: string | null): TimerMode {
  if (raw === "question") return "per_question";
  if (raw === "session") return "per_session";
  return null;
}

function PracticeInner() {
  const params = useSearchParams();
  const raw = params.get("mode") ?? "mixed";
  const mode: SessionMode = (VALID as string[]).includes(raw) ? (raw as SessionMode) : "mixed";
  const timerMode = parseTimer(params.get("timer"));
  // key forces a fresh session (and queue) when the mode/timer changes.
  return <PracticeSession key={`${mode}:${timerMode}`} mode={mode} timerMode={timerMode} />;
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading session…</div>}>
      <PracticeInner />
    </Suspense>
  );
}
