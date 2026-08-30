"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RootFilter } from "@/lib/phrasal";
import { usePhrasalDrill } from "@/hooks/usePhrasalDrill";
import { RootMatrix } from "@/components/phrasal/RootMatrix";
import { TextAnswer } from "@/components/practice/parts/TextAnswer";

/**
 * Reveal the authored target with its optional parts dimmed.
 *
 * Naming the shortest accepted string instead would be accurate but unreadable:
 * "look to [sb] for [sth]" reduces to "look to for", which is not English.
 * Dimming the slots shows the real verb AND what the learner never had to type,
 * without inventing a form nobody would say.
 */
function TargetReveal({ target }: { target: string }) {
  const parts = target.split(/(\[[^\]]*\])/g).filter((p) => p !== "");
  const hasOptional = parts.some((p) => p.startsWith("["));
  return (
    <>
      <div className="mt-3 font-mono text-lg text-ink">
        {parts.map((part, i) =>
          part.startsWith("[") ? (
            <span key={i} className="text-muted/50">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
      {hasOptional && (
        <div className="mt-1 text-xs text-muted">dimmed slots were not required</div>
      )}
    </>
  );
}

/**
 * Phrasal-verb rapid-fire drill.
 *
 * Production, not recognition: the learner is shown a meaning and must type the
 * verb. Answer → Enter grades it, Enter again advances. Standalone — it never
 * touches the Parts 1–4 queue, the ELO rating or the 80/20 session algorithm.
 */
export function PhrasalDrill({ initialRoot = "all" }: { initialRoot?: RootFilter }) {
  const s = usePhrasalDrill(initialRoot);
  const [value, setValue] = useState("");
  const [hinted, setHinted] = useState(false);

  const revealed = s.phase === "revealed";

  // Clear the input and the hint whenever a new item is shown.
  useEffect(() => {
    setValue("");
    setHinted(false);
  }, [s.index]);

  // Enter advances once an answer has been revealed. The answer input stops the
  // submitting Enter from bubbling (see TextAnswer), so this only ever fires on
  // a fresh keypress.
  useEffect(() => {
    if (!revealed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        s.next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, s]);

  const acc = s.sessionCount === 0 ? 0 : Math.round((s.sessionCorrect / s.sessionCount) * 100);
  const lifetimeAcc =
    s.lifetimeAttempts === 0 ? 0 : Math.round((s.lifetimeCorrect / s.lifetimeAttempts) * 100);

  const hud = (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-muted hover:text-ink">
          ← Dashboard
        </Link>
        <span className="text-muted">·</span>
        <span className="text-muted">Phrasal verbs · Rapid-fire drill</span>
      </div>
      <div className="flex items-center gap-4 font-mono tabular-nums">
        <span className="rounded bg-panel2 px-2 py-0.5 text-xs text-muted">
          {s.selectedRoot === "all" ? "All roots" : s.selectedRoot} · {s.poolSize}
        </span>
        <span className="text-muted">#{s.index}</span>
        <span className="text-muted">
          {s.sessionCorrect}/{s.sessionCount} ({acc}%)
        </span>
        <span title="streak">🔥 {s.streak}</span>
        <span className="text-accent" title="lifetime accuracy">
          {lifetimeAcc}%
        </span>
      </div>
    </div>
  );

  if (!s.ready) {
    return (
      <main>
        {hud}
        <div className="rounded-lg border border-border bg-panel p-8 text-center text-muted">
          Loading drill…
        </div>
      </main>
    );
  }

  if (!s.current) {
    return (
      <main>
        {hud}
        <RootMatrix selected={s.selectedRoot} dueByRoot={s.dueByRoot} onSelect={s.changeRoot} />
        <div className="rounded-lg border border-border bg-panel p-8 text-center text-muted">
          No verbs available for this root.
        </div>
      </main>
    );
  }

  const item = s.current;
  const result = s.lastResult;

  return (
    <main>
      {hud}

      <RootMatrix selected={s.selectedRoot} dueByRoot={s.dueByRoot} onSelect={s.changeRoot} />

      <div className="rounded-lg border border-border bg-panel p-6">
        <div className="text-xs uppercase tracking-wider text-muted">Produce the phrasal verb</div>

        <p className="mt-3 text-lg leading-relaxed">{item.definition}</p>
        <p className="mt-2 text-base italic leading-relaxed text-warn/90">{item.translation}</p>

        <div className="mt-6">
          <TextAnswer
            value={value}
            onChange={setValue}
            onSubmit={() => s.submit(value)}
            disabled={revealed}
            placeholder="type the phrasal verb…"
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
            <span>Brackets are optional — “get down” is enough for “get [sb] down”.</span>
            {/* In All-roots mode the root is real information, so it is a hint
                the learner asks for rather than something given away. With a
                single root selected it is already on screen in the matrix. */}
            {!revealed && s.selectedRoot === "all" && (
              <button
                type="button"
                onClick={() => setHinted(true)}
                className="shrink-0 text-accent hover:brightness-125 disabled:opacity-50"
                disabled={hinted}
              >
                {hinted ? `Root: ${item.root}` : "Reveal root"}
              </button>
            )}
          </div>
        </div>

        {result && (
          <div
            className={`mt-5 rounded-lg border p-4 ${
              result.correct ? "border-ok bg-ok/10" : "border-bad bg-bad/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`font-mono text-sm font-bold ${
                  result.correct ? "text-ok" : "text-bad"
                }`}
              >
                {result.correct ? "CORRECT" : "INCORRECT"}
              </span>
              <button
                onClick={s.next}
                className="rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110"
              >
                Next ↵
              </button>
            </div>

            <TargetReveal target={result.target} />
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        {s.dueAll > 0
          ? `${s.dueAll} verb${s.dueAll === 1 ? "" : "s"} due for review · best streak ${s.bestStreak}`
          : `Nothing due for review · best streak ${s.bestStreak}`}
      </p>
    </main>
  );
}
