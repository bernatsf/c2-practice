"use client";

import Link from "next/link";
import type { Question } from "@/lib/types";
import type { ExamItemResult, ExamResult } from "@/lib/exam";
import { GapText } from "@/components/practice/GapText";

// Tailwind needs literal class names, so map the band tone to concrete classes
// rather than interpolating the token.
const TONE: Record<string, { text: string; border: string; bg: string }> = {
  ok: { text: "text-ok", border: "border-ok/50", bg: "bg-ok/10" },
  accent: { text: "text-accent", border: "border-accent/50", bg: "bg-accent/10" },
  warn: { text: "text-warn", border: "border-warn/50", bg: "bg-warn/10" },
  bad: { text: "text-bad", border: "border-bad/50", bg: "bg-bad/10" },
};

// Part 1 answers are stored as option keys ("B"); show the option text so the
// review reads as language rather than as letters.
function displayAnswer(q: Question, raw: string): string {
  if (!raw.trim()) return "—";
  if (q.part !== 1) return raw;
  const opt = q.options?.find((o) => o.key.toLowerCase() === raw.trim().toLowerCase());
  return opt ? `${opt.key} — ${opt.text}` : raw;
}

function ReviewItem({ item, n }: { item: ExamItemResult; n: number }) {
  const { question: q, correct, answered } = item;
  const tone = correct ? "border-ok/40" : "border-bad/40";

  return (
    <li className={`rounded-md border ${tone} bg-panel2 p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2 text-xs text-muted">
          <span className="font-mono">Q{n}</span>
          <span className={correct ? "text-ok" : "text-bad"}>
            {correct ? "✓ correct" : answered ? "✗ incorrect" : "✗ not answered"}
          </span>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted">
          {item.marks}/{item.maxMarks}
        </span>
      </div>

      {/* Stem: Part 4 shows the lead sentence + key word, the rest a gapped line. */}
      {q.part === 4 ? (
        <div className="mt-2 text-sm">
          <p className="text-muted">{q.leadSentence}</p>
          <p className="mt-1">
            <span className="mr-2 rounded bg-panel px-2 py-0.5 font-mono text-xs uppercase tracking-widest text-accent">
              {q.keyWord}
            </span>
          </p>
          <p className="mt-1 leading-relaxed">
            <GapText text={q.gapped ?? ""} />
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm leading-relaxed">
          <GapText text={q.context ?? ""} />
          {q.part === 3 && (
            <span className="ml-2 rounded bg-panel px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-muted">
              {q.rootWord}
            </span>
          )}
        </p>
      )}

      <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <span className="text-xs uppercase tracking-wider text-muted">Your answer</span>
          <div className={`font-mono ${correct ? "text-ok" : "text-bad"}`}>
            {displayAnswer(q, item.userAnswer)}
          </div>
        </div>
        {!correct && (
          <div>
            <span className="text-xs uppercase tracking-wider text-muted">Accepted</span>
            <div className="font-mono text-ink">{item.accepted.join("  /  ")}</div>
          </div>
        )}
      </div>

      {item.message && <p className="mt-1.5 text-xs text-warn">{item.message}</p>}
      {!correct && q.explanation && (
        <p className="mt-2 border-t border-border pt-2 text-sm text-muted">{q.explanation}</p>
      )}
    </li>
  );
}

export function ExamResults({
  result,
  timedOut,
  onRestart,
}: {
  result: ExamResult;
  timedOut: boolean;
  onRestart: () => void;
}) {
  const t = TONE[result.band.tone] ?? TONE.bad;

  // Number each item within its own part, matching the navigator's labelling.
  const seen: Record<number, number> = {};
  const numbered = result.items.map((item) => {
    seen[item.question.part] = (seen[item.question.part] ?? 0) + 1;
    return { item, n: seen[item.question.part] };
  });

  return (
    <main className="space-y-5">
      <div className="text-sm">
        <Link href="/" className="text-muted hover:text-ink">
          ← Dashboard
        </Link>
      </div>

      {timedOut && (
        <div className="rounded-md border border-warn/50 bg-warn/10 px-4 py-2.5 text-sm text-warn">
          Time expired — the paper was submitted automatically with the answers you had entered.
        </div>
      )}

      {/* Headline score + grade */}
      <section className={`rounded-lg border ${t.border} ${t.bg} p-6 text-center`}>
        <div className="text-xs uppercase tracking-wider text-muted">Final score</div>
        <div className="mt-1 font-mono text-5xl font-semibold tabular-nums">
          {result.marks}
          <span className="text-2xl text-muted">/{result.maxMarks}</span>
        </div>
        <div className="mt-1 font-mono text-lg tabular-nums text-muted">{result.percentage}%</div>
        <div className={`mt-4 text-2xl font-semibold ${t.text}`}>{result.band.title}</div>
        <div className="mt-0.5 text-sm text-muted">{result.band.level}</div>
        <div className="mt-3 text-xs text-muted">
          {result.answeredCount}/{result.items.length} questions attempted
        </div>
      </section>

      {/* Per-part breakdown */}
      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="text-xs uppercase tracking-wider text-muted">Breakdown by part</div>
        <div className="mt-3 space-y-2">
          {result.parts.map((p) => {
            const frac = p.maxMarks === 0 ? 0 : p.marks / p.maxMarks;
            return (
              <div key={p.part} className="flex items-center gap-3">
                <div className="w-56 shrink-0 truncate text-sm">{p.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel2">
                  <div
                    className={`h-full ${frac >= 0.8 ? "bg-ok" : frac >= 0.6 ? "bg-warn" : "bg-bad"}`}
                    style={{ width: `${frac * 100}%` }}
                  />
                </div>
                <div className="w-24 shrink-0 text-right font-mono text-sm tabular-nums text-muted">
                  {p.marks}/{p.maxMarks} marks
                </div>
                <div className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
                  {p.correctCount}/{p.count} right
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Questions you didn&apos;t get right have been added to your spaced-repetition queue. Your
          ELO rating and streak are unaffected by exam mode.
        </p>
      </section>

      {/* Full review */}
      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="text-xs uppercase tracking-wider text-muted">Answer review</div>
        <ol className="mt-3 space-y-2">
          {numbered.map(({ item, n }) => (
            <ReviewItem key={item.question.id} item={item} n={n} />
          ))}
        </ol>
      </section>

      <div className="flex justify-center gap-3 pb-4">
        <button
          onClick={onRestart}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Sit another exam →
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-5 py-2.5 text-sm text-muted hover:text-ink"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
