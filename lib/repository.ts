import type { Attempt, CategoryStat, PhrasalProfile, Profile, SrsItem } from "./types";

// Storage contract. localStorage impl is the default; a Supabase impl can
// satisfy the same interface later with zero changes to components/hooks.
//
// The phrasal-verb drill gets its own SRS map and its own profile rather than
// sharing the exam ones. Same SM-2 code (`lib/srs.ts`), separate keys: ids from
// the two banks are drawn from different namespaces and must never collide in
// one schedule, and the drill must not move the CPE ELO rating.
export interface StatsRepository {
  getProfile(): Profile;
  saveProfile(p: Profile): void;
  getAttempts(): Attempt[];
  appendAttempt(a: Attempt): void;
  getCategoryStats(): Record<string, CategoryStat>;
  saveCategoryStats(s: Record<string, CategoryStat>): void;
  getSrs(): Record<string, SrsItem>;
  saveSrsItem(item: SrsItem): void;
  getPhrasalSrs(): Record<string, SrsItem>;
  savePhrasalSrsItem(item: SrsItem): void;
  getPhrasalProfile(): PhrasalProfile;
  savePhrasalProfile(p: PhrasalProfile): void;
  reset(): void;
}

export const STARTING_RATING = 1700;

export function freshPhrasalProfile(): PhrasalProfile {
  return {
    totalAttempts: 0,
    totalCorrect: 0,
    currentStreak: 0,
    bestStreak: 0,
    updatedAt: Date.now(),
  };
}

export function freshProfile(): Profile {
  return {
    rating: STARTING_RATING,
    peakRating: STARTING_RATING,
    currentStreak: 0,
    bestStreak: 0,
    totalAttempts: 0,
    totalCorrect: 0,
    updatedAt: Date.now(),
  };
}
