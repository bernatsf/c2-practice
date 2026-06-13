import type { Attempt, CategoryStat, Profile, SrsItem } from "./types";

// Storage contract. localStorage impl is the default; a Supabase impl can
// satisfy the same interface later with zero changes to components/hooks.
export interface StatsRepository {
  getProfile(): Profile;
  saveProfile(p: Profile): void;
  getAttempts(): Attempt[];
  appendAttempt(a: Attempt): void;
  getCategoryStats(): Record<string, CategoryStat>;
  saveCategoryStats(s: Record<string, CategoryStat>): void;
  getSrs(): Record<string, SrsItem>;
  saveSrsItem(item: SrsItem): void;
  reset(): void;
}

export const STARTING_RATING = 1700;

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
