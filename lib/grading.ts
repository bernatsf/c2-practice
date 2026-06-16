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

// Common English contractions → full-text expansions. Used ONLY to compare
// answers: per Cambridge marking, "didn't" and "did not" are equivalent, so a
// user typing either form should match an accepted answer stored in either form.
// Ambiguous forms ('s, 'd) are mapped to their most frequent expansion; because
// the map is applied to both the user input and the accepted answer, the match
// stays correct as long as both sides resolve the same way.
const CONTRACTIONS: Record<string, string> = {
  "didn't": "did not",
  "don't": "do not",
  "doesn't": "does not",
  "wasn't": "was not",
  "weren't": "were not",
  "isn't": "is not",
  "aren't": "are not",
  "ain't": "is not",
  "hasn't": "has not",
  "haven't": "have not",
  "hadn't": "had not",
  "won't": "will not",
  "wouldn't": "would not",
  "can't": "cannot",
  "couldn't": "could not",
  "shouldn't": "should not",
  "mustn't": "must not",
  "needn't": "need not",
  "shan't": "shall not",
  "mightn't": "might not",
  "it's": "it is",
  "he's": "he is",
  "she's": "she is",
  "that's": "that is",
  "there's": "there is",
  "here's": "here is",
  "what's": "what is",
  "who's": "who is",
  "let's": "let us",
  "i'm": "i am",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "i'll": "i will",
  "you'll": "you will",
  "he'll": "he will",
  "she'll": "she will",
  "we'll": "we will",
  "they'll": "they will",
  "i'd": "i would",
  "you'd": "you would",
  "he'd": "he would",
  "she'd": "she would",
  "we'd": "we would",
  "they'd": "they would",
};

// Expand contractions token-by-token. Expects an already-normalized string
// (lowercase, single-spaced); apostrophes are preserved by normalize(), and
// curly apostrophes are folded to straight ones first.
function expandContractions(s: string): string {
  return s
    .replace(/[’‘`]/g, "'")
    .split(" ")
    .map((token) => CONTRACTIONS[token] ?? token)
    .join(" ");
}

// Comparison-only normalization: normalize() plus contraction expansion.
export function normalizeForMatch(s: string): string {
  return expandContractions(normalize(s));
}

// Count words the way Cambridge does: a contraction counts as its expanded
// form, so "didn't" is two words ("did not") toward the strict word limit.
function wordCount(s: string): number {
  const t = expandContractions(normalize(s));
  return t.length === 0 ? 0 : t.split(" ").length;
}

export function grade(q: Question, raw: string): GradeResult {
  const user = normalize(raw);
  const accepted = q.answers;

  // Part 1: answer is an option key (A–D). Accept either the key or the text.
  if (q.part === 1) {
    const userMatch = normalizeForMatch(raw);
    const correctKey = normalize(accepted[0]);
    const opt = q.options?.find((o) => normalizeForMatch(o.text) === userMatch);
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

    const userMatch = normalizeForMatch(raw);
    const matches = accepted.some((a) => normalizeForMatch(a) === userMatch);

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
  const userMatch = normalizeForMatch(raw);
  const correct = accepted.some((a) => normalizeForMatch(a) === userMatch);
  return { correct, accepted };
}
