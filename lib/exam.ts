import type { Part, Question } from "./types";
import { grade } from "./grading";
import { SEED_BANK, withShuffledOptions } from "./seed";

// ── C2 exam simulation ─────────────────────────────────────────────────────
//
// A full mock of the CPE Use of English paper: 30 questions drawn at random
// from the item bank, sat against a 45-minute clock, then marked out of 36 and
// mapped onto Cambridge grade bands.
//
// This module is deliberately PURE — it builds papers and scores them, but
// never touches localStorage. Persistence (recording missed items to the SRS
// queue) lives in useExamSession, which keeps the scoring rules trivially
// testable and free of browser dependencies.

export const EXAM_DURATION_MS = 45 * 60 * 1000; // 45 minutes

export interface PartSpec {
  part: Part;
  count: number; // how many questions of this part appear on the paper
  marksPerQuestion: number;
  label: string;
  instruction: string;
}

// Mirrors the real paper: Parts 1–3 carry one mark per item, Part 4 carries
// two, giving 8 + 8 + 8 + 12 = 36 marks across 30 questions.
export const EXAM_BLUEPRINT: PartSpec[] = [
  {
    part: 1,
    count: 8,
    marksPerQuestion: 1,
    label: "Part 1 · Multiple-choice cloze",
    instruction: "Choose the word which best fits each gap.",
  },
  {
    part: 2,
    count: 8,
    marksPerQuestion: 1,
    label: "Part 2 · Open cloze",
    instruction: "Write ONE word in each gap.",
  },
  {
    part: 3,
    count: 8,
    marksPerQuestion: 1,
    label: "Part 3 · Word formation",
    instruction: "Form a word that fits the gap using the word given.",
  },
  {
    part: 4,
    count: 6,
    marksPerQuestion: 2,
    label: "Part 4 · Key word transformation",
    instruction:
      "Complete the second sentence so it means the same as the first, using the key word. Two marks each.",
  },
];

export const TOTAL_QUESTIONS = EXAM_BLUEPRINT.reduce((n, s) => n + s.count, 0); // 30
export const TOTAL_MARKS = EXAM_BLUEPRINT.reduce(
  (n, s) => n + s.count * s.marksPerQuestion,
  0
); // 36

export function specFor(part: Part): PartSpec {
  // Every part in the blueprint is represented, so this never falls through in
  // practice; the fallback keeps the return type non-nullable for callers.
  return EXAM_BLUEPRINT.find((s) => s.part === part) ?? EXAM_BLUEPRINT[0];
}

// ── Grade bands ────────────────────────────────────────────────────────────
//
// Bands are keyed off RAW MARKS, not the percentage. The two are given as
// equivalent in the Cambridge-style benchmarks, but they disagree at the
// edges once you resolve them against a 36-mark total (25/36 is 69.4%, which
// would fall outside a literal "70%+" reading of Grade B). The integer mark
// thresholds are unambiguous, so they are the source of truth; the percentage
// is displayed alongside as a descriptive figure.

export type ExamGrade = "A" | "B" | "C" | "fail";

export interface GradeBand {
  grade: ExamGrade;
  title: string; // e.g. "Pass at Grade A"
  level: string; // e.g. "C2 Level — Exceptional"
  minMarks: number; // inclusive lower bound, out of TOTAL_MARKS
  tone: "ok" | "accent" | "warn" | "bad";
}

// Ordered strongest → weakest; the first band whose threshold is met wins.
export const GRADE_BANDS: GradeBand[] = [
  { grade: "A", title: "Pass at Grade A", level: "C2 Level — Exceptional", minMarks: 29, tone: "ok" },
  { grade: "B", title: "Pass at Grade B", level: "C2 Level — High", minMarks: 25, tone: "accent" },
  { grade: "C", title: "Pass at Grade C", level: "C2 Level — Standard", minMarks: 22, tone: "warn" },
  { grade: "fail", title: "Did Not Pass", level: "C1 Level", minMarks: 0, tone: "bad" },
];

export function bandFor(marks: number): GradeBand {
  return GRADE_BANDS.find((b) => marks >= b.minMarks) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
}

// ── Paper construction ─────────────────────────────────────────────────────

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// Draw a fresh paper: `count` distinct questions per part, in part order, with
// Part 1 option positions randomised so the correct choice isn't always first.
// Must be called client-side only — it uses Math.random(), so running it during
// SSR would produce a different paper than the client hydrates with.
export function buildExamPaper(bank: Question[] = SEED_BANK): Question[] {
  return EXAM_BLUEPRINT.flatMap((spec) => {
    const pool = bank.filter((q) => q.part === spec.part);
    return sample(pool, spec.count).map(withShuffledOptions);
  });
}

// ── Scoring ────────────────────────────────────────────────────────────────

export interface ExamItemResult {
  question: Question;
  userAnswer: string;
  answered: boolean;
  correct: boolean;
  marks: number;
  maxMarks: number;
  accepted: string[];
  message?: string; // constraint note from the grader (Part 4 word limits)
}

export interface ExamPartResult {
  part: Part;
  label: string;
  correctCount: number;
  count: number;
  marks: number;
  maxMarks: number;
}

export interface ExamResult {
  items: ExamItemResult[];
  parts: ExamPartResult[];
  marks: number;
  maxMarks: number;
  percentage: number;
  band: GradeBand;
  answeredCount: number;
}

// Mark a completed paper. Answers are keyed by question id; a missing or blank
// entry scores zero (an unanswered question is simply wrong, as in the real
// exam).
//
// Part 4 is all-or-nothing: Cambridge splits its two marks across two halves of
// the answer, but our grading engine matches a whole gap fill against a list of
// accepted strings and returns a single boolean, so a partially correct
// transformation cannot be detected. Two marks are awarded for an exact match,
// zero otherwise.
export function scoreExam(paper: Question[], answers: Record<string, string>): ExamResult {
  const items: ExamItemResult[] = paper.map((question) => {
    const raw = answers[question.id] ?? "";
    const answered = raw.trim().length > 0;
    const maxMarks = specFor(question.part).marksPerQuestion;
    const result = grade(question, raw);
    const correct = answered && result.correct;
    return {
      question,
      userAnswer: raw,
      answered,
      correct,
      marks: correct ? maxMarks : 0,
      maxMarks,
      accepted: result.accepted,
      // Suppress the grader's constraint note on blanks — "must be 3–8 words"
      // is noise when the candidate simply ran out of time.
      message: answered ? result.message : undefined,
    };
  });

  const parts: ExamPartResult[] = EXAM_BLUEPRINT.map((spec) => {
    const forPart = items.filter((i) => i.question.part === spec.part);
    return {
      part: spec.part,
      label: spec.label,
      correctCount: forPart.filter((i) => i.correct).length,
      count: forPart.length,
      marks: forPart.reduce((n, i) => n + i.marks, 0),
      maxMarks: forPart.reduce((n, i) => n + i.maxMarks, 0),
    };
  });

  const marks = items.reduce((n, i) => n + i.marks, 0);
  const maxMarks = items.reduce((n, i) => n + i.maxMarks, 0);

  return {
    items,
    parts,
    marks,
    maxMarks,
    percentage: maxMarks === 0 ? 0 : Math.round((marks / maxMarks) * 100),
    band: bandFor(marks),
    answeredCount: items.filter((i) => i.answered).length,
  };
}
