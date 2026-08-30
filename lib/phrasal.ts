import rawData from "../data/phrasal_verbs.json";
import { normalize } from "./grading";

// ── Phrasal-verb drill bank ────────────────────────────────────────────────
//
// A production drill, not a cloze: the learner is shown a meaning (English
// definition + ES/CA translation) and must produce the phrasal verb itself.
//
// The bank is authored in /data/phrasal_verbs.json — the single source of truth
// — and validated by `scripts/validate_phrasal_verbs.ts` (npm test / npm run
// build). It is deliberately a separate file and a separate type from
// `cpe_use_of_english.json`: these items are not exam questions, they carry no
// part number, no ELO difficulty and no options, and they must never leak into
// the Parts 1–4 queue.

export interface PhrasalVerb {
  id: string;
  root: string; // uppercase root verb, e.g. "GET" — the Root Matrix filter key
  target: string; // canonical form WITH markers, e.g. "get down to doing [sth]"
  definition: string; // concise C2 English gloss
  translation: string; // "castellano / català"
}

/** Root Matrix selection: every root, or one specific root. */
export type RootFilter = "all" | string;

export const PHRASAL_BANK: PhrasalVerb[] = rawData as PhrasalVerb[];

export const PHRASAL_BY_ID: Map<string, PhrasalVerb> = new Map(
  PHRASAL_BANK.map((p) => [p.id, p])
);

/** Roots in bank order (the order they were authored in), each listed once. */
export const PHRASAL_ROOTS: string[] = Array.from(new Set(PHRASAL_BANK.map((p) => p.root)));

export function phrasalsForRoot(root: RootFilter): PhrasalVerb[] {
  return root === "all" ? PHRASAL_BANK : PHRASAL_BANK.filter((p) => p.root === root);
}

// ── Answer normalization ───────────────────────────────────────────────────
//
// Targets carry two kinds of notation that a learner must not have to type:
//
//   [ ... ]  an argument slot — "get [sb] down", "hold out for [better terms]".
//            Stripped for comparison, so "get down" is accepted. The bracketed
//            text is ALSO accepted, so someone who types the fuller form
//            ("get sb down") is not punished for being explicit.
//
//   a / b    interchangeable particles — "get round / around [sb]",
//            "call on / upon [sb] to do [sth]". Each alternative is expanded
//            into its own accepted form, so "call on" and "call upon" both mark
//            correct. Slashes INSIDE brackets ("[sb/sth]") are argument-slot
//            notation, not alternatives, and are left alone.
//
// Everything outside those two groups is required verbatim — in particular the
// grammatical markers the list preserves on purpose ("doing" in "set about
// doing [sth]", "to do" in "set out to do [sth]").

/** Placeholder spellings a learner might type out in full. */
const PLACEHOLDER_FOLDS: [RegExp, string][] = [
  [/\b(?:somebody|someone)\b/g, "sb"],
  [/\b(?:something|smth)\b/g, "sth"],
];

/**
 * Comparison-only normalization. Builds on the shared `normalize()` from the
 * grading engine (lowercase, punctuation, whitespace) and adds the three things
 * this drill needs: bracket characters are meaningless as typed input, a
 * leading infinitive "to " is a habit rather than an error, and sb/sth may be
 * spelled out.
 */
export function normalizeForPhrasalMatch(s: string): string {
  let out = normalize(s.replace(/[[\]]/g, " "));
  out = out.replace(/^to\s+/, "");
  for (const [re, rep] of PLACEHOLDER_FOLDS) out = out.replace(re, rep);
  return out.replace(/\s+/g, " ").trim();
}

/** Split a target into literal chunks and `[bracketed]` chunks, in order. */
function chunksOf(target: string): string[] {
  return target.split(/(\[[^\]]*\])/g).filter((c) => c.trim() !== "");
}

// Expansion is exponential in the number of optional groups. Authored targets
// top out at three, but `acceptedForms` also runs over raw learner input (see
// `gradePhrasal`), so the product is capped rather than trusted.
const MAX_FORMS = 64;

/** Cartesian product of per-position alternatives, joined with single spaces. */
function combine(groups: string[][]): string[] {
  let out: string[] = [""];
  for (const group of groups) {
    const next: string[] = [];
    for (const prefix of out) {
      for (const alt of group) next.push(alt === "" ? prefix : `${prefix} ${alt}`);
    }
    // Past the cap, keep expanding along the first alternative only: the result
    // stays correct for well-formed input and merely stops being exhaustive for
    // pathological input.
    out = next.length > MAX_FORMS ? next.slice(0, MAX_FORMS) : next;
  }
  return out.map((s) => s.replace(/\s+/g, " ").trim());
}

/**
 * Expand `a / b` alternations inside one literal chunk. Slashes are spaced out
 * first so that both "on / upon" and a hypothetical "on/upon" tokenize the same
 * way, then each `X / Y / Z` run collapses into one alternative group.
 */
function expandSlashes(chunk: string): string[] {
  const tokens = chunk
    .replace(/\//g, " / ")
    .trim()
    .split(/\s+/)
    .filter((t) => t !== "");
  if (tokens.length === 0) return [""];

  const groups: string[][] = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === "/") {
      i += 1; // a leading/dangling slash carries no alternative
      continue;
    }
    const alts = [tokens[i]];
    let j = i + 1;
    while (tokens[j] === "/" && tokens[j + 1] !== undefined) {
      alts.push(tokens[j + 1]);
      j += 2;
    }
    groups.push(alts);
    i = j;
  }
  return combine(groups);
}

/**
 * Every accepted spelling of a target, normalized and deduped. A bracket group
 * contributes ["", its contents] (absent or present); a literal chunk
 * contributes its slash alternatives.
 */
export function acceptedForms(target: string): string[] {
  const groups = chunksOf(target).map((chunk) => {
    const bracket = chunk.trim().match(/^\[([^\]]*)\]$/);
    return bracket ? ["", bracket[1]] : expandSlashes(chunk);
  });
  const forms = combine(groups)
    .map(normalizeForPhrasalMatch)
    .filter((f) => f !== "");
  return Array.from(new Set(forms));
}

/**
 * The shortest thing the drill will accept: brackets dropped, first alternative
 * of any slash pair.
 *
 * This is a CHECKING aid, not a display string — for a target whose slots sit
 * between particles it reduces to something no one would say ("look to [sb] for
 * [sth]" → "look to for"). `scripts/validate_phrasal_verbs.ts` uses it to prove
 * every item is answerable with the markers stripped; the UI reveals the
 * authored target with its optional parts dimmed instead.
 */
export function coreForm(target: string): string {
  const stripped = target
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/(\S+)\s*\/\s*\S+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return stripped;
}

export interface PhrasalGrade {
  correct: boolean;
  target: string; // the authored form, with markers, for display
}

export function gradePhrasal(item: PhrasalVerb, raw: string): PhrasalGrade {
  // The input goes through the SAME expander as the target, rather than a
  // one-sided normalization. A learner who copies the notation back — "come
  // round / around", "get [sb] down" — is naming alternatives and optional
  // slots exactly as the target does, and either reading is right. Expanding
  // both sides identically is also what keeps slashes inside bracket text
  // ("[sb/sth]") from being mistaken for alternation: on both sides they sit
  // inside a bracket group, which the expander never splits.
  const accepted = new Set(acceptedForms(item.target));
  const correct = acceptedForms(raw).some((f) => accepted.has(f));
  return { correct, target: item.target };
}
