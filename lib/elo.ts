// ELO rating update for user ↔ item.
// User starts high (strong C1 baseline); items carry their own difficulty.

const K_BASE = 24;
const K_EARLY = 40; // faster convergence during first attempts
const EARLY_THRESHOLD = 30;

export function expected(userRating: number, itemDifficulty: number): number {
  return 1 / (1 + 10 ** ((itemDifficulty - userRating) / 400));
}

export function kFactor(totalAttempts: number): number {
  return totalAttempts < EARLY_THRESHOLD ? K_EARLY : K_BASE;
}

export interface RatingUpdate {
  newUser: number;
  newItem: number;
  delta: number; // change to the user's rating
}

export function updateRatings(
  userRating: number,
  itemDifficulty: number,
  correct: boolean,
  totalAttempts: number
): RatingUpdate {
  const k = kFactor(totalAttempts);
  const e = expected(userRating, itemDifficulty);
  const s = correct ? 1 : 0;
  const newUser = Math.round(userRating + k * (s - e));
  // The item "wins" when the user fails.
  const newItem = Math.round(itemDifficulty + k * (e - s));
  return { newUser, newItem, delta: newUser - userRating };
}
