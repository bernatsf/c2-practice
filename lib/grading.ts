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
// Every entry here has exactly one reading; ambiguous forms live in
// AMBIGUOUS_CONTRACTIONS below.
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
  "oughtn't": "ought not",
  "daren't": "dare not",
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
};

// Contractions with more than one full form. "'d" is "would" OR "had" ("we'd
// reserved" is past perfect, "we'd rather" is not); "'s" is "is" OR "has"
// ("he's gone"). Forcing one reading turned "we'd reserved" into the
// ungrammatical "we would reserved", so a candidate who contracted "had" could
// never match "we had reserved". Instead every reading is kept as a candidate
// form and an answer matches if ANY reading does. The first reading is the
// canonical one used by normalizeForMatch(); all readings have the same word
// count, so word-limit checks are unaffected by which one is chosen.
const AMBIGUOUS_CONTRACTIONS: Record<string, string[]> = {};
for (const subject of ["i", "you", "he", "she", "it", "we", "they", "who", "that", "there"]) {
  AMBIGUOUS_CONTRACTIONS[`${subject}'d`] = [`${subject} would`, `${subject} had`];
}
for (const subject of ["he", "she", "it", "that", "there", "here", "what", "who"]) {
  AMBIGUOUS_CONTRACTIONS[`${subject}'s`] = [`${subject} is`, `${subject} has`];
}

// Hard cap on readings per answer, so a pathological input full of ambiguous
// contractions cannot blow up combinatorially (2^n). Real answers have ≤ 2.
const MAX_CONTRACTION_READINGS = 16;

// Expand contractions token-by-token into every possible reading. Expects an
// already-normalized string (lowercase, single-spaced); apostrophes are
// preserved by normalize(), and curly apostrophes are folded to straight ones
// first. The first element is always the canonical reading.
function expandContractions(s: string): string[] {
  let readings = [""];
  for (const token of s.replace(/[’‘`]/g, "'").split(" ")) {
    const options = AMBIGUOUS_CONTRACTIONS[token] ?? [CONTRACTIONS[token] ?? token];
    const next: string[] = [];
    for (const prefix of readings) {
      for (const option of options) {
        if (next.length < MAX_CONTRACTION_READINGS) {
          next.push(prefix === "" ? option : `${prefix} ${option}`);
        }
      }
    }
    readings = next;
  }
  return readings;
}

// Cambridge treats certain dialect/spelling variants as interchangeable. Each
// rule folds a variant to a single canonical form; because the same folding is
// applied to both the user input and the accepted answer, either spelling on
// either side compares equal. Word boundaries (\b) keep us from mangling
// substrings (e.g. "towards" must not become "towardss"). Note "can't" is
// already handled by CONTRACTIONS ("can't" → "cannot"); the rule below adds the
// spaced form "can not" → "cannot", completing the three-way equivalence.
const DIALECT_EQUIVALENTS: [RegExp, string][] = [
  [/\bso long as\b/g, "as long as"],
  [/\btowards\b/g, "toward"],
  [/\bamongst\b/g, "among"],
  [/\bwhilst\b/g, "while"],
  [/\bcan not\b/g, "cannot"],
];

function applyDialectEquivalents(s: string): string {
  let out = s;
  for (const [re, rep] of DIALECT_EQUIVALENTS) out = out.replace(re, rep);
  return out;
}

// Every comparison form of a string: normalize() plus contraction expansion
// (one entry per reading of an ambiguous contraction) plus dialect folding.
// Order matters — contraction expansion runs first so its output (e.g.
// "cannot") is visible to the dialect rules. The first entry is canonical.
export function matchForms(s: string): string[] {
  return Array.from(new Set(expandContractions(normalize(s)).map(applyDialectEquivalents)));
}

// The single canonical comparison form (first reading of any ambiguous
// contraction). Fine for word counting, where every reading has the same
// length; use matchForms()/formsOverlap() when deciding whether two answers
// are equal, so "we'd" can match both "we would" and "we had".
export function normalizeForMatch(s: string): string {
  return matchForms(s)[0];
}

function formsOverlap(a: string[], b: string[]): boolean {
  return a.some((form) => b.includes(form));
}

// Cambridge Part 4 rule: the key word must appear in the answer UNCHANGED.
// True when some reading of the answer contains the key word as a whole word.
// Case-insensitive (an answer may start a sentence), and a contraction counts
// as its full form, so "wish we'd reserved" contains key word HAD. An inflected
// or absent key word ("wished", "hads") fails.
export function containsKeyWord(answer: string, keyWord: string): boolean {
  // Padding with spaces gives whole-word matching that also works when the key
  // itself expands to two words (WON'T → "will not").
  const keyForms = matchForms(keyWord).map((key) => ` ${key} `);
  return matchForms(answer).some((form) => keyForms.some((key) => ` ${form} `.includes(key)));
}

// Expand a stored answer's optional bracketed words into every concrete
// permutation. A group like "(that)" or "(in)" may be present or absent, so an
// answer with n groups yields up to 2^n variants — e.g.
// "did they know (that) the mutation" →
//   ["did they know that the mutation", "did they know the mutation"].
// Answers without brackets return unchanged (single-element array).
export function expandOptionalWords(answer: string): string[] {
  if (!answer.includes("(")) return [answer];

  // Split into literal text and "(optional)" groups, preserving order.
  const parts = answer.split(/(\([^)]*\))/g).filter((p) => p !== "");
  const results: string[] = [];

  const build = (idx: number, acc: string): void => {
    if (idx === parts.length) {
      results.push(acc);
      return;
    }
    const group = parts[idx].match(/^\(([^)]*)\)$/);
    if (group) {
      build(idx + 1, acc + group[1]); // with the optional word
      build(idx + 1, acc); //           without it
    } else {
      build(idx + 1, acc + parts[idx]);
    }
  };
  build(0, "");

  // Collapse whitespace left where a word was dropped, then dedupe.
  const cleaned = results.map((r) => r.replace(/\s+/g, " ").trim());
  return Array.from(new Set(cleaned));
}

// Count words the way Cambridge does: a contraction counts as its expanded
// form, so "didn't" is two words ("did not") toward the strict word limit, and
// dialect variants count as their canonical form ("can't"/"can not"/"cannot"
// all count as one word).
function wordCount(s: string): number {
  const t = normalizeForMatch(s);
  return t.length === 0 ? 0 : t.split(" ").length;
}

export function grade(q: Question, raw: string): GradeResult {
  const user = normalize(raw);
  const accepted = q.answers;

  // Part 1: answer is an option key (A–D). Accept either the key or the text.
  if (q.part === 1) {
    const userForms = matchForms(raw);
    const correctKey = normalize(accepted[0]);
    const opt = q.options?.find((o) => formsOverlap(matchForms(o.text), userForms));
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

    // The key word gate runs FIRST and applies to every submission, matched or
    // not. It checks the user's own text, and a matched answer is by
    // definition equal to that text, so a stored answer that omits or inflects
    // the key word can never be credited either.
    if (q.keyWord && !containsKeyWord(raw, q.keyWord)) {
      return { correct: false, accepted, message: `Must use the key word "${q.keyWord}" unchanged.` };
    }

    const userForms = matchForms(raw);

    // Expand any optional bracketed words so each accepted answer contributes
    // all of its concrete permutations, then find the one the user matched.
    const permutations = accepted.flatMap(expandOptionalWords);
    const matched = permutations.find((p) => formsOverlap(matchForms(p), userForms));

    if (matched) {
      // The word limit is enforced against the permutation that actually
      // matched — dropping/keeping an optional word can change the count.
      const pn = wordCount(matched);
      if (pn >= min && pn <= max) return { correct: true, accepted };
      return { correct: false, accepted, message: `Answer must be ${min}–${max} words (you used ${pn}).` };
    }

    // No match → give the most exam-relevant feedback, based on the raw input.
    const n = wordCount(raw);
    if (n < min || n > max) {
      return { correct: false, accepted, message: `Answer must be ${min}–${max} words (you used ${n}).` };
    }
    return { correct: false, accepted };
  }

  // Parts 2 & 3: the accepted array holds spelling/variant forms. Expand any
  // optional bracketed words too, so "(...)" notation works uniformly across
  // every part and every string in the array.
  const userForms = matchForms(raw);
  const permutations = accepted.flatMap(expandOptionalWords);
  const correct = permutations.some((a) => formsOverlap(matchForms(a), userForms));
  return { correct, accepted };
}
