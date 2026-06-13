import type { SrsItem } from "./types";

// SM-2–style spaced repetition, adapted for binary (correct/incorrect) grading.
//   • A correct answer grows the interval and nudges ease up.
//   • An incorrect answer is a lapse: reps reset, ease drops, and the item
//     becomes due immediately so it resurfaces in review and the next session.

export const DAY = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const START_EASE = 2.5;

export function freshSrsItem(questionId: string, now = Date.now()): SrsItem {
  return {
    questionId,
    ease: START_EASE,
    reps: 0,
    intervalDays: 0,
    dueAt: now,
    failCount: 0,
    lapses: 0,
    lastResult: null,
    lastReviewedAt: now,
  };
}

function clampEase(e: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, e));
}

// Apply a review result to an item, returning the updated record.
export function reviewSrs(item: SrsItem, correct: boolean, now = Date.now()): SrsItem {
  if (correct) {
    const reps = item.reps + 1;
    const intervalDays =
      item.reps === 0 ? 1 : item.reps === 1 ? 3 : Math.round(item.intervalDays * item.ease);
    return {
      ...item,
      reps,
      intervalDays,
      ease: clampEase(item.ease + 0.1),
      dueAt: now + intervalDays * DAY,
      lastResult: true,
      lastReviewedAt: now,
    };
  }
  return {
    ...item,
    reps: 0,
    intervalDays: 0,
    ease: clampEase(item.ease - 0.2),
    failCount: item.failCount + 1,
    lapses: item.lapses + (item.reps > 0 ? 1 : 0),
    dueAt: now, // immediately due
    lastResult: false,
    lastReviewedAt: now,
  };
}

export function isDue(item: SrsItem, now = Date.now()): boolean {
  return item.dueAt <= now;
}

export function dueCount(items: SrsItem[], now = Date.now()): number {
  return items.filter((i) => isDue(i, now)).length;
}

// Priority for the review queue: previously-failed items first, then the most
// overdue, then the lowest ease (hardest). Returns null when nothing is due.
export function selectNextSrsId(
  items: SrsItem[],
  now = Date.now(),
  excludeId: string | null = null
): string | null {
  const due = items.filter((i) => isDue(i, now));
  if (due.length === 0) return null;

  due.sort((a, b) => {
    const trouble = b.failCount + b.lapses - (a.failCount + a.lapses);
    if (trouble !== 0) return trouble;
    const overdue = b.dueAt === a.dueAt ? 0 : a.dueAt - b.dueAt; // more overdue first
    if (overdue !== 0) return overdue;
    return a.ease - b.ease;
  });

  if (due[0].questionId === excludeId && due.length > 1) {
    return due[1].questionId;
  }
  return due[0].questionId;
}
