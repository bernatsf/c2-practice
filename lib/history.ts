import type { Part } from "./types";
import type { ExamGrade, ExamResult } from "./exam";

// ── Exam simulation history ────────────────────────────────────────────────
//
// Aggregate-only record of completed exam simulations: one entry per finished
// paper, holding the score breakdown and the time taken. Deliberately does NOT
// store the questions or the candidate's answers — the point is a trend line,
// not a transcript, and keeping the entries tiny means the log can never
// approach the localStorage quota.
//
// The key is `cpe_test_history` rather than the `cpe.*` convention used by
// `localRepository`, so `localRepository.reset()` does not touch it; the
// history is cleared through `clearTestHistory` instead.

export const HISTORY_KEY = "cpe_test_history";

// Ring buffer: a completed 45-minute paper is a rare event, so 50 entries is
// years of history, but the cap keeps a runaway loop from filling storage.
const HISTORY_CAP = 50;

export const HISTORY_PARTS: Part[] = [1, 2, 3, 4];

export interface TestPartScore {
  correct: number; // questions answered correctly
  count: number; // questions of this part on the paper
  marks: number; // marks earned (Part 4 carries 2 per question)
  maxMarks: number;
}

export interface TestHistoryEntry {
  id: string; // unique; timestamp-derived
  date: string; // ISO 8601, when the paper was submitted
  totalTimeSeconds: number; // wall-clock time spent on the paper
  overallScore: number; // marks earned across the whole paper
  maxMarks: number;
  percentage: number;
  grade: ExamGrade;
  gradeTitle: string; // e.g. "Pass at Grade B"
  timedOut: boolean; // the clock ran out rather than the user submitting
  partScores: Record<Part, TestPartScore>;
}

function emptyPartScore(): TestPartScore {
  return { correct: 0, count: 0, marks: 0, maxMarks: 0 };
}

function emptyPartScores(): Record<Part, TestPartScore> {
  return { 1: emptyPartScore(), 2: emptyPartScore(), 3: emptyPartScore(), 4: emptyPartScore() };
}

// ── Storage ────────────────────────────────────────────────────────────────
//
// SSR-safe and failure-tolerant, mirroring `lib/localRepository.ts`: a browser
// with storage disabled degrades to "no history" rather than crashing a render.

function read(): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(entries: TestHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    /* quota / serialization — non-fatal for a trainer */
  }
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// Coerce one stored record back into the current shape. Entries are plain JSON
// that a previous version of the app (or a hand-edited devtools session) may
// have written, so nothing about the parsed value can be assumed — a missing
// `partScores.3` would otherwise crash the table on render.
function reviveEntry(raw: unknown): TestHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.date !== "string") return null;

  const storedParts = (e.partScores ?? {}) as Record<string, unknown>;
  const partScores = emptyPartScores();
  for (const part of HISTORY_PARTS) {
    const p = storedParts[String(part)];
    if (p && typeof p === "object") {
      const s = p as Record<string, unknown>;
      partScores[part] = {
        correct: num(s.correct),
        count: num(s.count),
        marks: num(s.marks),
        maxMarks: num(s.maxMarks),
      };
    }
  }

  const grade = e.grade;
  return {
    id: e.id,
    date: e.date,
    totalTimeSeconds: num(e.totalTimeSeconds),
    overallScore: num(e.overallScore),
    maxMarks: num(e.maxMarks),
    percentage: num(e.percentage),
    grade:
      grade === "A" || grade === "B" || grade === "C" || grade === "fail" ? grade : "fail",
    gradeTitle: typeof e.gradeTitle === "string" ? e.gradeTitle : "",
    timedOut: e.timedOut === true,
    partScores,
  };
}

// Oldest first, as stored. Callers that want newest first reverse it.
export function getTestHistory(): TestHistoryEntry[] {
  const raw = read();
  if (!Array.isArray(raw)) return [];
  return raw
    .map(reviveEntry)
    .filter((e): e is TestHistoryEntry => e !== null);
}

export function appendTestEntry(entry: TestHistoryEntry): void {
  const all = getTestHistory();
  all.push(entry);
  if (all.length > HISTORY_CAP) all.splice(0, all.length - HISTORY_CAP);
  write(all);
}

export function clearTestHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

// ── Construction & formatting ──────────────────────────────────────────────

// Build a history entry from a marked paper. Pure: the caller decides when the
// paper finished and how long it took, which keeps this testable and keeps the
// clock out of the data layer.
export function entryFromExamResult(
  result: ExamResult,
  opts: { totalTimeSeconds: number; timedOut: boolean; finishedAt?: number }
): TestHistoryEntry {
  const finishedAt = opts.finishedAt ?? Date.now();
  const partScores = emptyPartScores();
  for (const p of result.parts) {
    partScores[p.part] = {
      correct: p.correctCount,
      count: p.count,
      marks: p.marks,
      maxMarks: p.maxMarks,
    };
  }

  return {
    // Timestamp plus a random suffix: two papers submitted in the same
    // millisecond is implausible, but a duplicate id would collide as a React
    // key and make the two rows indistinguishable.
    id: `${finishedAt}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date(finishedAt).toISOString(),
    totalTimeSeconds: Math.max(0, Math.round(opts.totalTimeSeconds)),
    overallScore: result.marks,
    maxMarks: result.maxMarks,
    percentage: result.percentage,
    grade: result.band.grade,
    gradeTitle: result.band.title,
    timedOut: opts.timedOut,
    partScores,
  };
}

// MM:SS. Minutes are not wrapped at 60 — a 45-minute paper reads "44:58", and
// anything longer stays legible rather than silently rolling over.
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
