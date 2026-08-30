import type { Attempt, CategoryStat, PhrasalProfile, Profile, SrsItem } from "./types";
import { freshPhrasalProfile, freshProfile, StatsRepository } from "./repository";

const KEYS = {
  profile: "cpe.profile",
  attempts: "cpe.attempts",
  category: "cpe.categoryStats",
  srs: "cpe.srs",
  // Phrasal-verb drill. Separate keys, so the drill's schedule and progress sit
  // alongside the exam ones without ever mixing with them. Both are listed here
  // so `reset()` clears them together — a half-wiped profile would leave the
  // drill claiming mastery of items the learner no longer has any history for.
  phrasalSrs: "cpe.phrasal.srs",
  phrasalProfile: "cpe.phrasal.profile",
} as const;

const ATTEMPT_CAP = 2000; // ring buffer

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / serialization — non-fatal for a trainer */
  }
}

export const localRepository: StatsRepository = {
  getProfile() {
    return read<Profile>(KEYS.profile, freshProfile());
  },
  saveProfile(p: Profile) {
    write(KEYS.profile, p);
  },
  getAttempts() {
    return read<Attempt[]>(KEYS.attempts, []);
  },
  appendAttempt(a: Attempt) {
    const all = read<Attempt[]>(KEYS.attempts, []);
    all.push(a);
    if (all.length > ATTEMPT_CAP) all.splice(0, all.length - ATTEMPT_CAP);
    write(KEYS.attempts, all);
  },
  getCategoryStats() {
    return read<Record<string, CategoryStat>>(KEYS.category, {});
  },
  saveCategoryStats(s: Record<string, CategoryStat>) {
    write(KEYS.category, s);
  },
  getSrs() {
    return read<Record<string, SrsItem>>(KEYS.srs, {});
  },
  saveSrsItem(item: SrsItem) {
    const all = read<Record<string, SrsItem>>(KEYS.srs, {});
    all[item.questionId] = item;
    write(KEYS.srs, all);
  },
  getPhrasalSrs() {
    return read<Record<string, SrsItem>>(KEYS.phrasalSrs, {});
  },
  savePhrasalSrsItem(item: SrsItem) {
    const all = read<Record<string, SrsItem>>(KEYS.phrasalSrs, {});
    all[item.questionId] = item;
    write(KEYS.phrasalSrs, all);
  },
  getPhrasalProfile() {
    return read<PhrasalProfile>(KEYS.phrasalProfile, freshPhrasalProfile());
  },
  savePhrasalProfile(p: PhrasalProfile) {
    write(KEYS.phrasalProfile, p);
  },
  reset() {
    if (typeof window === "undefined") return;
    Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
  },
};

/**
 * Every question id the learner has already met, for unseen-first selection
 * (`lib/selection.ts`).
 *
 * Two sources, because neither is complete on its own:
 *   - `cpe.attempts` is the full answer log, but it is a ring buffer capped at
 *     ATTEMPT_CAP, so the oldest attempts are evicted and their items would
 *     otherwise look new again;
 *   - `cpe.srs` is keyed by question id and never trimmed, so it remembers items
 *     whose attempts have aged out.
 * The union is therefore a strictly better "seen" signal than either alone.
 *
 * Returns an empty set during SSR, which makes every item count as unseen —
 * harmless, since selection only ever runs client-side.
 */
export function seenQuestionIds(): Set<string> {
  const ids = new Set<string>();
  for (const attempt of localRepository.getAttempts()) ids.add(attempt.questionId);
  for (const questionId of Object.keys(localRepository.getSrs())) ids.add(questionId);
  return ids;
}

/**
 * Every phrasal-verb id the learner has already drilled.
 *
 * Unlike `seenQuestionIds` there is only one source: the drill keeps no attempt
 * log, so an SRS record IS the record of having met an item. That map is never
 * trimmed, so nothing ages back into looking new.
 */
export function seenPhrasalIds(): Set<string> {
  return new Set(Object.keys(localRepository.getPhrasalSrs()));
}
