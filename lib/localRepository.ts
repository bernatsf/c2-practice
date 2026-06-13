import type { Attempt, CategoryStat, Profile, SrsItem } from "./types";
import { freshProfile, StatsRepository } from "./repository";

const KEYS = {
  profile: "cpe.profile",
  attempts: "cpe.attempts",
  category: "cpe.categoryStats",
  srs: "cpe.srs",
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
  reset() {
    if (typeof window === "undefined") return;
    Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
  },
};
