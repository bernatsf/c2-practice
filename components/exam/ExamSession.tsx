"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useExamSession } from "@/hooks/useExamSession";
import { useCountdown } from "@/hooks/useCountdown";
import { EXAM_DURATION_MS, specFor, TOTAL_MARKS } from "@/lib/exam";
import { QuestionRenderer } from "@/components/practice/QuestionRenderer";
import { ExamTimer } from "./ExamTimer";
import { ExamNavigator } from "./ExamNavigator";
import { ExamResults } from "./ExamResults";

export function ExamSession({ onRestart }: { onRestart: () => void }) {
  const s = useExamSession();

  const onExpire = useCallback(() => s.submit({ timedOut: true }), [s]);

  const remainingMs = useCountdown({
    durationMs: EXAM_DURATION_MS,
    active: s.ready && !s.result,
    resetKey: "exam",
    onExpire,
  });

  const handleFinish = useCallback(() => {
    const blank = s.paper.length - s.answeredCount;
    const warning =
      blank > 0
        ? `You have ${blank} unanswered question${blank === 1 ? "" : "s"}. Submit anyway?`
        : "Submit your paper for marking?";
    if (confirm(warning)) s.submit();
  }, [s]);

  // Pre-mount: the paper is drawn client-side (Math.random), so render a stable
  // placeholder until it exists to keep server and client HTML identical.
  if (!s.ready || !s.current) {
    return <div className="text-sm text-muted">Preparing your exam paper…</div>;
  }

  if (s.result) {
    return <ExamResults result={s.result} timedOut={s.timedOut} onRestart={onRestart} />;
  }

  const q = s.current;
  const spec = specFor(q.part);
  // Position of this question within its own part (Parts are contiguous in the
  // paper, so counting same-part items up to `index` gives the local number).
  const localNumber = s.paper.slice(0, s.index + 1).filter((x) => x.part === q.part).length;
  const value = s.answers[q.id] ?? "";
  const atStart = s.index === 0;
  const atEnd = s.index === s.paper.length - 1;

  return (
    <main className="space-y-4 pb-6">
      <ExamTimer remainingMs={remainingMs} durationMs={EXAM_DURATION_MS} />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">C2 Exam Simulation</h1>
          <p className="text-sm text-muted">
            {s.paper.length} questions · {TOTAL_MARKS} marks · 45 minutes
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="font-mono tabular-nums">
            {s.answeredCount}
            <span className="text-muted">/{s.paper.length} answered</span>
          </div>
          <Link href="/" className="text-xs text-muted hover:text-bad">
            Abandon exam
          </Link>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-panel p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
          <div>
            <div className="text-sm font-medium text-accent">{spec.label}</div>
            <div className="mt-0.5 text-xs text-muted">{spec.instruction}</div>
          </div>
          <div className="font-mono text-xs tabular-nums text-muted">
            Question {localNumber} of {spec.count} · {spec.marksPerQuestion} mark
            {spec.marksPerQuestion === 1 ? "" : "s"}
          </div>
        </div>

        {/* `disabled` is always false: exam mode never reveals answers mid-paper,
            so the shared part components render as pure inputs. Keying on the
            question id remounts the input between questions, which resets focus
            to the new gap. */}
        <QuestionRenderer
          key={q.id}
          q={q}
          disabled={false}
          value={value}
          onChange={(v) => s.setAnswer(q.id, v)}
          onSubmit={s.next}
          onSelectOption={(key) => s.setAnswer(q.id, key)}
        />

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            onClick={s.prev}
            disabled={atStart}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>
          {q.part !== 1 && (
            <span className="hidden text-xs text-muted sm:block">Press Enter for the next question.</span>
          )}
          <button
            onClick={s.next}
            disabled={atEnd}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>

      <ExamNavigator paper={s.paper} answers={s.answers} index={s.index} onGoTo={s.goTo} />

      <div className="flex justify-center">
        <button
          onClick={handleFinish}
          className="rounded-md bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Finish &amp; submit paper
        </button>
      </div>
    </main>
  );
}
