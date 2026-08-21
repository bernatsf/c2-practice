import type { Question } from "./types";

// ── Unseen-first weighted selection ────────────────────────────────────────
//
// The bank is large (1800+ items) and grows in bulk batches, so uniform random
// sampling buries new material: after a few hundred attempts a learner is still
// overwhelmingly likely to draw something they have already answered. Sessions
// and exam papers therefore over-sample items with no attempt history.
//
// This module is PURE — no localStorage, no Math.random seeding, nothing that
// differs between server and client beyond Math.random itself. That is what
// lets `lib/exam.ts` keep its own no-persistence guarantee while still
// weighting its papers: the caller supplies the set of seen ids.

/** Share of a requested batch drawn from unseen items, when enough exist. */
export const UNSEEN_SHARE = 0.75;

export interface Partitioned<T> {
  unseenItems: T[];
  seenItems: T[];
}

export function partitionBySeen<T extends { id: string }>(
  items: readonly T[],
  seenIds: ReadonlySet<string>
): Partitioned<T> {
  const unseenItems: T[] = [];
  const seenItems: T[] = [];
  for (const item of items) {
    if (seenIds.has(item.id)) seenItems.push(item);
    else unseenItems.push(item);
  }
  return { unseenItems, seenItems };
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw `n` distinct items, `unseenShare` of them from `unseenItems`.
 *
 * Either bucket may be too small to meet its quota, and BOTH shortfalls have to
 * be covered, not just the documented one:
 *   - few unseen left (the steady state for a long-term user) → top up from seen;
 *   - no seen yet (a brand-new user, whose history is empty) → take the whole
 *     batch from unseen.
 * Without the second case a first-ever session would come back short.
 *
 * The result is shuffled, so position never reveals whether an item is new —
 * otherwise the first three quarters of every session would be the unseen ones.
 */
export function weightedSample<T extends { id: string }>(
  unseenItems: readonly T[],
  seenItems: readonly T[],
  n: number,
  unseenShare: number = UNSEEN_SHARE
): T[] {
  if (n <= 0) return [];

  const unseenPool = shuffle(unseenItems);
  const seenPool = shuffle(seenItems);

  const unseenQuota = Math.min(unseenPool.length, Math.round(n * unseenShare));
  const picked: T[] = unseenPool.slice(0, unseenQuota);

  // Fill the rest from seen items, then fall back to any unseen left over when
  // the seen bucket runs dry first.
  picked.push(...seenPool.slice(0, n - picked.length));
  if (picked.length < n) {
    picked.push(...unseenPool.slice(unseenQuota, unseenQuota + (n - picked.length)));
  }

  return shuffle(picked);
}

/** Convenience wrapper for the common case of one flat pool. */
export function sampleUnseenFirst<T extends { id: string }>(
  items: readonly T[],
  seenIds: ReadonlySet<string>,
  n: number,
  unseenShare: number = UNSEEN_SHARE
): T[] {
  const { unseenItems, seenItems } = partitionBySeen(items, seenIds);
  return weightedSample(unseenItems, seenItems, n, unseenShare);
}

export type { Question };
