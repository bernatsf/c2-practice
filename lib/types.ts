// ── Domain types ───────────────────────────────────────────────────────────

export type Part = 1 | 2 | 3 | 4;

export type Category =
  | "phrasal_verb"
  | "preposition"
  | "collocation"
  | "fixed_phrase"
  | "idiom"
  | "linking_word"
  | "false_friend"
  | "word_formation"
  | "lexical"
  | "grammar";

export type L1Trap = "false_friend" | "prep_mismatch" | "phrasal" | null;

export type SessionMode = "part1" | "part2" | "part3" | "part4" | "mixed" | "srs";

// Review-queue filter: every part, or one specific part.
export type PartFilter = "all" | Part;

// Due-item counts keyed by filter value ("all" = total across parts).
export type PartDueCounts = Record<PartFilter, number>;

export type TimerMode = null | "per_question" | "per_session";

export interface Question {
  id: string;
  part: Part;
  category: Category;
  difficulty: number; // ELO rating of the item

  l1Trap?: L1Trap;
  l1Note?: string; // e.g. "ES 'depender de' → EN 'depend ON'"

  context?: string; // sentence/paragraph; gap marked with "____" (Parts 1–3)
  explanation?: string; // shown only on incorrect

  // Part 1 only
  options?: { key: string; text: string }[];

  // Part 3 only
  rootWord?: string;

  // Part 4 only
  leadSentence?: string;
  keyWord?: string;
  gapped?: string; // second sentence with the gap "____"
  minWords?: number; // default 3
  maxWords?: number; // default 8

  // Accepted answers (array → spelling/grammar variants).
  // Part 1: ["A"]. Parts 2/3: the word. Part 4: the gap fill phrase(s).
  answers: string[];

  source: "seed" | "llm";
}

// ── Persistence shapes ─────────────────────────────────────────────────────

export interface Profile {
  rating: number;
  peakRating: number;
  currentStreak: number;
  bestStreak: number;
  totalAttempts: number;
  totalCorrect: number;
  updatedAt: number;
}

export interface Attempt {
  questionId: string;
  part: Part;
  category: Category;
  userAnswer: string;
  isCorrect: boolean;
  responseMs: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
  itemDifficulty: number;
  createdAt: number;
}

// Lightweight progress record for the phrasal-verb drill. Deliberately NOT the
// exam `Profile`: the drill is a production task with no ELO item difficulty,
// so folding its answers into the CPE rating would distort it.
export interface PhrasalProfile {
  totalAttempts: number;
  totalCorrect: number;
  currentStreak: number;
  bestStreak: number;
  updatedAt: number;
}

export interface CategoryStat {
  category: Category;
  attempts: number;
  correct: number;
  rollingAcc: number; // last N in this category (0..1)
  avgResponseMs: number;
}

export interface GradeResult {
  correct: boolean;
  accepted: string[]; // the canonical correct answer(s) to display
  message?: string; // e.g. constraint violation note (Part 4)
}

// Spaced-repetition state, one record per item ever attempted.
//
// Used by two independent schedules that share the SM-2 code in `lib/srs.ts`
// but never share storage: the Parts 1–4 question bank (`cpe.srs`) and the
// phrasal-verb drill (`cpe.phrasal.srs`). `questionId` therefore holds a
// question id in the first and a phrasal-verb id in the second.
export interface SrsItem {
  questionId: string;
  ease: number; // SM-2 ease factor
  reps: number; // consecutive correct reviews (resets to 0 on a lapse)
  intervalDays: number; // current scheduling interval
  dueAt: number; // epoch ms — when the item next becomes due
  failCount: number; // total incorrect attempts (lifetime)
  lapses: number; // failures after the item had been learned (reps > 0)
  lastResult: boolean | null;
  lastReviewedAt: number;
}
