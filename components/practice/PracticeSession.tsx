"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionMode, TimerMode } from "@/lib/types";
import { MODE_LABEL } from "@/components/labels";
import { usePracticeSession } from "@/hooks/usePracticeSession";
import { useCountdown } from "@/hooks/useCountdown";
import { SessionHUD } from "./SessionHUD";
import { SessionTimer } from "./SessionTimer";
import { QuestionRenderer } from "./QuestionRenderer";
import { FeedbackBar } from "./FeedbackBar";

// Per-question allowance: transformations (Part 4) get more time.
const perQuestionMs = (part: number) => (part === 4 ? 75_000 : 40_000);
const SESSION_MS = 300_000; // 5-minute sprint

export function PracticeSession({
  mode,
  timerMode,
}: {
  mode: SessionMode;
  timerMode: TimerMode;
}) {
  const s = usePracticeSession(mode);
  const [value, setValue] = useState("");
  const [ended, setEnded] = useState(false); // per-session timeout

  const revealed = s.phase === "revealed";

  // Latest answer, so a timer expiry submits what's currently entered.
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleNext = useCallback(() => {
    s.next();
    setValue("");
  }, [s]);

  // Part 1: selecting an option commits immediately.
  const handleSelectOption = useCallback(
    (key: string) => {
      if (revealed) return;
      setValue(key);
      s.submit(key);
    },
    [revealed, s]
  );

  // A *fresh* Enter press advances to the next question while feedback shows.
  //
  // Crucial guard: text answers (Parts 2–4) are submitted with Enter. Holding
  // that key down emits auto-repeat keydown events; once this listener attaches
  // (right after submit flips `revealed` true), those repeats would instantly
  // advance the queue and wipe the InlineReveal/FeedbackBar before the user can
  // read them. Ignoring `e.repeat` means submitting never advances — the user
  // must lift the key and press Enter again, or click "Next". (Part 1 submits
  // by click, so its first post-reveal Enter is already a fresh, non-repeat
  // press and keeps working.)
  useEffect(() => {
    if (!revealed) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.repeat) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [revealed, handleNext]);

  // ── Timer ────────────────────────────────────────────────────────────────
  const isPerQuestion = timerMode === "per_question";
  const isPerSession = timerMode === "per_session";
  const durationMs = isPerSession ? SESSION_MS : s.current ? perQuestionMs(s.current.part) : 40_000;

  const onExpire = useCallback(() => {
    if (isPerSession) {
      setEnded(true);
    } else if (s.phase === "answering") {
      s.submit(valueRef.current); // time's up → submit whatever is entered
    }
  }, [isPerSession, s]);

  const timerActive =
    !!timerMode &&
    s.ready &&
    !!s.current &&
    !ended &&
    (isPerSession ? true : s.phase === "answering");

  const remainingMs = useCountdown({
    durationMs,
    active: timerActive,
    resetKey: isPerSession ? "session" : `q-${s.index}`,
    onExpire,
  });

  // Pre-mount: render a stable placeholder so server and client HTML match.
  if (!s.ready) {
    return <div className="text-sm text-muted">Loading session…</div>;
  }

  // Per-session time's up.
  if (ended) {
    const acc = s.sessionCount === 0 ? 0 : Math.round((s.sessionCorrect / s.sessionCount) * 100);
    return (
      <main>
        <div className="mb-5 text-sm">
          <Link href="/" className="text-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-panel p-8 text-center">
          <div className="text-lg font-medium">Time&apos;s up</div>
          <p className="mt-2 text-sm text-muted">
            {s.sessionCorrect}/{s.sessionCount} correct ({acc}%) · rating {s.currentRating}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href={`/practice?mode=${mode}&timer=session`}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
              onClick={() => setEnded(false)}
            >
              Run again →
            </Link>
            <Link
              href="/"
              className="rounded-md border border-border px-4 py-2 text-sm text-muted hover:text-ink"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Review mode with nothing due (or no history yet).
  if (!s.current) {
    return (
      <main>
        <div className="mb-5 text-sm">
          <Link href="/" className="text-muted hover:text-ink">
            ← Dashboard
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-panel p-8 text-center">
          <div className="text-lg font-medium">Nothing due for review</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {s.sessionCount > 0
              ? "You've cleared every item that was due. Failed items will reappear here, and correct ones return on a spaced schedule."
              : "Practise any part first — items you miss are tracked and prioritised here for review."}
          </p>
          <Link
            href="/practice?mode=mixed"
            className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            Start a Mixed session →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <SessionHUD
        modeLabel={MODE_LABEL[mode]}
        part={s.current.part}
        category={s.current.category}
        index={s.index}
        streak={s.streak}
        sessionCorrect={s.sessionCorrect}
        sessionCount={s.sessionCount}
        rating={s.currentRating}
      />

      <div className="rounded-lg border border-border bg-panel p-6">
        {timerMode && (
          <SessionTimer
            remainingMs={remainingMs}
            durationMs={durationMs}
            label={isPerSession ? "Session time" : "Time left"}
          />
        )}

        <QuestionRenderer
          q={s.current}
          disabled={revealed}
          value={value}
          onChange={setValue}
          onSubmit={() => s.submit(value)}
          onSelectOption={handleSelectOption}
        />

        {revealed && s.lastResult ? (
          <FeedbackBar
            result={s.lastResult}
            question={s.current}
            delta={s.lastDelta}
            onNext={handleNext}
          />
        ) : (
          s.current.part !== 1 && (
            <p className="mt-4 text-xs text-muted">Press Enter to submit.</p>
          )
        )}
      </div>
    </main>
  );
}
