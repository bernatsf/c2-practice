"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearTestHistory,
  formatDuration,
  getTestHistory,
  HISTORY_PARTS,
  type TestHistoryEntry,
} from "@/lib/history";

// Grade → colour, matching the bands used on the results screen. Tailwind needs
// literal class names, so this maps rather than interpolates.
const GRADE_TONE: Record<TestHistoryEntry["grade"], string> = {
  A: "text-ok",
  B: "text-accent",
  C: "text-warn",
  fail: "text-bad",
};

function partTone(correct: number, count: number): string {
  if (count === 0) return "text-muted";
  const frac = correct / count;
  if (frac >= 0.8) return "text-ok";
  if (frac >= 0.6) return "text-warn";
  return "text-bad";
}

// Short, unambiguous, and locale-aware. Safe to call because rows only ever
// render after mount — the server always renders the loading placeholder, so a
// locale difference between server and client can't cause a hydration mismatch.
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function SimulationHistory() {
  const [entries, setEntries] = useState<TestHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    // Newest first: the most recent sitting is what you want to see.
    setEntries(getTestHistory().reverse());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const handleClear = useCallback(() => {
    if (!confirm("Clear your simulation history? This cannot be undone.")) return;
    clearTestHistory();
    refresh();
  }, [refresh]);

  return (
    <div className="rounded-lg border border-border bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="text-xs uppercase tracking-wider text-muted">
          Simulation history · most recent first
        </div>
        {entries.length > 0 && (
          <button onClick={handleClear} className="text-xs text-muted hover:text-bad">
            Clear history
          </button>
        )}
      </div>

      {!loaded ? (
        <div className="px-4 py-6 text-sm text-muted">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted">
          No simulations completed yet. Sit a full 45-minute paper and your score, time and
          per-part breakdown will be logged here.
        </div>
      ) : (
        // The per-part columns make this table wider than a phone; scrolling the
        // table itself keeps the page body from scrolling sideways.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Time</th>
                <th className="px-4 py-2 text-right font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Grade</th>
                {HISTORY_PARTS.map((part) => (
                  <th key={part} className="px-3 py-2 text-right font-medium">
                    P{part}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-4 py-2">
                    {formatDate(e.date)}
                    <span className="ml-2 text-xs text-muted">{formatTime(e.date)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums text-muted">
                    {formatDuration(e.totalTimeSeconds)}
                    {e.timedOut && (
                      <span className="ml-1.5 text-xs text-warn" title="Time expired">
                        ⏱
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums">
                    {e.overallScore}
                    <span className="text-muted">/{e.maxMarks}</span>
                    <span className="ml-2 text-xs text-muted">{e.percentage}%</span>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2 font-medium ${GRADE_TONE[e.grade]}`}>
                    {e.grade === "fail" ? "Did not pass" : `Grade ${e.grade}`}
                  </td>
                  {HISTORY_PARTS.map((part) => {
                    const p = e.partScores[part];
                    return (
                      <td
                        key={part}
                        className={`px-3 py-2 text-right font-mono tabular-nums ${partTone(
                          p.correct,
                          p.count
                        )}`}
                        title={`${p.marks}/${p.maxMarks} marks`}
                      >
                        {p.correct}/{p.count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
