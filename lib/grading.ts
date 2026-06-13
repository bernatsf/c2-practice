import type { Question, GradeResult } from "./types";

// Normalize free-text answers: lowercase, trim, collapse whitespace,
// strip surrounding punctuation that doesn't change correctness.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?"]/g, "")
    .replace(/\s+/g, " ");
}

function wordCount(s: string): number {
  const t = normalize(s);
  return t.length === 0 ? 0 : t.split(" ").length;
}

export function grade(q: Question, raw: string): GradeResult {
  const user = normalize(raw);
  const accepted = q.answers;

  // Part 1: answer is an option key (A–D). Accept either the key or the text.
  if (q.part === 1) {
    const correctKey = normalize(accepted[0]);
    const opt = q.options?.find((o) => normalize(o.text) === user);
    const correct = user === correctKey || (opt ? normalize(opt.key) === correctKey : false);
    const correctText = q.options?.find((o) => normalize(o.key) === correctKey)?.text;
    return {
      correct,
      accepted: correctText ? [`${accepted[0]} — ${correctText}`] : accepted,
    };
  }

  // Part 4: validate constraints, then match the gap fill.
  if (q.part === 4) {
    const min = q.minWords ?? 3;
    const max = q.maxWords ?? 8;
    const n = wordCount(raw);
    const key = q.keyWord ? normalize(q.keyWord) : null;

    const matches = accepted.some((a) => normalize(a) === user);

    if (matches) return { correct: true, accepted };

    // Right idea but breaks an exam rule → distinct, exam-relevant feedback.
    if (key && !user.split(" ").includes(key)) {
      return { correct: false, accepted, message: `Must use the key word "${q.keyWord}" unchanged.` };
    }
    if (n < min || n > max) {
      return { correct: false, accepted, message: `Answer must be ${min}–${max} words (you used ${n}).` };
    }
    return { correct: false, accepted };
  }

  // Parts 2 & 3: single word (array allows spelling/variant forms).
  const correct = accepted.some((a) => normalize(a) === user);
  return { correct, accepted };
}
