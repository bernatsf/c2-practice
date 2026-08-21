/**
 * Context-loss audit for Part 4 items in `cpe_use_of_english.json`.
 *
 * THE DEFECT THIS HUNTS
 * ---------------------
 * A Part 4 transformation must preserve the meaning of the lead sentence. The
 * candidate rewrites one part of it around the key word; everything else —
 * especially circumstantial adjuncts like "about the interview", "last year",
 * "in front of the committee" — has to survive somewhere in the finished
 * second sentence. When the model answer silently drops such a phrase and the
 * fixed frame of `targetSentence` does not carry it either, the stored answer
 * is worth at most 1/2 marks in a real exam, and the item quietly teaches the
 * candidate to omit information.
 *
 * `p4-156` shipped in exactly that state: lead "…the most surprising thing
 * about the interview", target "____ was her composure.", answer "What most
 * surprised me" — "about the interview" existed nowhere in the answer key.
 *
 * WHY THIS CANNOT BE A HARD VALIDATOR
 * -----------------------------------
 * Part 4 exists to make the candidate *replace* lexis: "cancelled" legitimately
 * disappears when the answer is "called off". A word missing from the answer is
 * therefore the normal case, not the defect. The distinguishing signal is
 * grammatical rather than lexical:
 *
 *   - a missing PREPOSITIONAL PHRASE or TIME/PLACE ADVERBIAL is an adjunct, and
 *     adjuncts are not what the transformation targets — they are carried over.
 *     Their absence is a real loss of information.
 *   - a single missing CONTENT WORD with no preposition in front of it is
 *     almost always the item's transformation target (the word the paraphrase
 *     is supposed to replace), and is expected.
 *
 * The report is bucketed on exactly that distinction. Buckets 1 and 2 are the
 * findings; bucket 3 is printed only under --all and exists to show the
 * detector's raw recall, not to be acted on.
 *
 * KNOWN FALSE-POSITIVE MODE
 * -------------------------
 * When a transformation paraphrases the adjunct itself (lead "at the start of
 * the meeting" → target "when the meeting began"), the preposition and its noun
 * both vanish legitimately and the item lands in bucket 1. This is why the
 * script prints a report and exits 0 instead of failing a build: every hit
 * needs a human to confirm the phrase was dropped rather than rephrased.
 *
 * Morphology is handled by a light stemmer, so "surprising" in the lead counts
 * as covered by "surprised" in the answer. Stemming is deliberately aggressive:
 * over-stemming causes missed detections (safe here — a human still reads the
 * item), while under-stemming would flood bucket 3 with inflection noise.
 *
 * Read-only. Never writes to the bank.
 *
 *   npx tsx scripts/audit_part4_context.ts               # findings only
 *   npx tsx scripts/audit_part4_context.ts --all         # + transformation targets
 *   npx tsx scripts/audit_part4_context.ts --bank <path> # audit a candidate bank
 *
 * `--bank` exists so a batch can be audited BEFORE it is appended: the adding
 * script writes a merged candidate file and points this at it, which keeps this
 * script the single authority on context loss instead of tempting each batch
 * script to grow its own inferior copy of the detector. It defaults to the live
 * bank, so `npm run audit:p4` is unchanged.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expandOptionalWords, normalizeForMatch } from "../lib/grading";

// Same defaults the grader applies to every Part 4 item (lib/types.ts).
const MIN_WORDS = 3;
const MAX_WORDS = 8;

// ── Lexicon ────────────────────────────────────────────────────────────────

// Prepositions and subordinators. Held apart from STOPWORDS because their
// absence is the primary evidence: a missing preposition means a missing
// adjunct, which is precisely what a transformation should have preserved.
const PREPOSITIONS = new Set([
  "about", "above", "across", "after", "against", "along", "amid", "among", "amongst",
  "around", "at", "before", "behind", "below", "beneath", "beside", "besides", "between",
  "beyond", "by", "despite", "down", "during", "except", "for", "from", "in", "inside",
  "into", "near", "of", "off", "on", "onto", "opposite", "outside", "over", "past",
  "since", "through", "throughout", "till", "to", "toward", "towards", "under",
  "underneath", "until", "unto", "up", "upon", "via", "with", "within", "without",
]);

// Function words that carry no standalone context. A gap in these is never by
// itself evidence of information loss.
const STOPWORDS = new Set([
  // determiners & quantifiers
  "a", "an", "the", "this", "that", "these", "those", "each", "every", "all", "both",
  "some", "any", "no", "none", "either", "neither", "such", "other", "another", "own",
  // pronouns
  "i", "me", "my", "mine", "myself", "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself",
  "we", "us", "our", "ours", "ourselves", "they", "them", "their", "theirs", "themselves",
  "who", "whom", "whose", "which", "what", "whatever", "whoever", "whichever",
  // be / have / do
  "am", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having", "do", "does", "did", "doing", "done",
  // modals
  "will", "would", "shall", "should", "can", "could", "may", "might", "must", "ought",
  // conjunctions & connectives
  "and", "or", "but", "nor", "so", "yet", "if", "unless", "because", "as", "than",
  "though", "although", "whether", "while", "whilst", "whereas", "however", "therefore",
  "thus", "hence", "moreover", "furthermore", "nevertheless", "nonetheless",
  // degree / polarity / misc high-frequency
  "not", "there", "here", "very", "too", "also", "just", "only", "even", "more", "most",
  "less", "least", "much", "many", "few", "fewer", "little", "quite", "rather", "so",
  "how", "why", "when", "where", "then", "thing", "things", "one", "ones",

  // Frequency, polarity and indefinite-place adverbs. These sit in STOPWORDS
  // deliberately, despite being adverbials, because they are the single most
  // common TRANSFORMATION TARGET in the bank: the inversion items exist
  // precisely to turn "never" into "Under no circumstances", "rarely" into
  // "Seldom", "anywhere" into "Nowhere else". Treating them as adjuncts that
  // must survive produced a flood of false positives on the first run.
  "never", "rarely", "seldom", "ever", "always", "often", "usually", "sometimes",
  "occasionally", "frequently", "hardly", "scarcely", "barely", "anywhere",
  "somewhere", "nowhere", "everywhere", "now", "soon", "already", "still", "yet",
  "again", "recently", "lately", "once", "twice", "immediately", "suddenly",
]);

// Time and place adverbials that form adjuncts WITHOUT a preposition, e.g.
// "yesterday", "last week", "three years ago". Unlike the frequency adverbs
// above these are referential — they name a specific time or place, so nothing
// in the transformation recovers them and their absence is real information
// loss. Missing these is the same defect as a missing PP.
const ADVERBIAL_MARKERS = new Set([
  "yesterday", "today", "tomorrow", "tonight", "ago", "last", "next",
  "second", "seconds", "minute", "minutes", "hour", "hours", "day", "days",
  "week", "weeks", "month", "months", "year", "years", "decade", "decades",
  "morning", "afternoon", "evening", "night", "weekend", "century", "centuries",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "abroad", "overseas", "upstairs", "downstairs", "outdoors", "indoors", "home",
]);

// Irregular forms a suffix stripper cannot relate. Only pairs that plausibly
// straddle a lead sentence and its transformation are worth listing.
const IRREGULAR: Record<string, string> = {
  went: "go", gone: "go", goes: "go",
  took: "take", taken: "take", takes: "take",
  gave: "give", given: "give",
  made: "make", said: "say", saw: "see", seen: "see", sees: "see",
  came: "come", become: "becom", became: "becom",
  got: "get", gotten: "get", knew: "know", known: "know",
  thought: "think", brought: "bring", bought: "buy", caught: "catch", taught: "teach",
  found: "find", told: "tell", left: "leav", felt: "feel", kept: "keep", held: "hold",
  meant: "mean", met: "meet", paid: "pay", put: "put", ran: "run", run: "run",
  sold: "sell", sent: "send", spent: "spend", stood: "stand", won: "win", wrote: "writ",
  written: "writ", spoke: "speak", spoken: "speak", broke: "break", broken: "break",
  chose: "choos", chosen: "choos", drove: "driv", driven: "driv", fell: "fall",
  fallen: "fall", forgot: "forget", forgotten: "forget", lost: "los", heard: "hear",
  children: "child", people: "person", men: "man", women: "woman", feet: "foot",
  teeth: "tooth", lives: "life", wives: "wife", knives: "knif", leaves: "leav",
  better: "good", best: "good", worse: "bad", worst: "bad",
};

// ── Morphology ─────────────────────────────────────────────────────────────

/**
 * Light suffix-stripping stemmer. Its only job is to decide whether a lead-
 * sentence word survives somewhere in the answer or target frame, so it errs
 * toward conflation: "surprising"/"surprised"/"surprise" all reduce to
 * "surpris", which is what stops p4-156's key word from being reported as a
 * dropped noun.
 */
function stem(raw: string): string {
  let w = raw.toLowerCase().replace(/[^a-z'-]/g, "");
  if (w === "") return w;
  if (IRREGULAR[w]) return IRREGULAR[w];
  w = w.replace(/'s$/, "");

  // Plurals / 3rd person singular.
  if (/[^aeiou]ies$/.test(w) && w.length > 4) w = w.slice(0, -3) + "i";
  else if (/(ss|ch|sh|x|z|s)es$/.test(w) && w.length > 4) w = w.slice(0, -2);
  else if (/[^s]s$/.test(w) && w.length > 3) w = w.slice(0, -1);

  // Verbal inflection.
  if (/ing$/.test(w) && w.length > 5) w = w.slice(0, -3);
  else if (/ed$/.test(w) && w.length > 4) w = w.slice(0, -2);

  // Adverbial -ly, then a conservative derivational pass: these relate
  // "decide"/"decision" and "able"/"ability" closely enough for coverage, and
  // the minimum-length guard keeps short words intact.
  if (/ly$/.test(w) && w.length > 4) w = w.slice(0, -2);
  for (const suffix of ["ation", "ness", "ment", "ance", "ence", "tion", "sion",
                        "ity", "ous", "ful", "less", "able", "ible", "ive", "al"]) {
    if (w.endsWith(suffix) && w.length - suffix.length >= 4) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }

  // Trailing silent -e, then a doubled final consonant ("cancell" → "cancel").
  if (/e$/.test(w) && w.length > 3) w = w.slice(0, -1);
  if (/([^aeiou])\1$/.test(w) && w.length > 3) w = w.slice(0, -1);
  if (/y$/.test(w) && w.length > 3) w = w.slice(0, -1) + "i";

  return w;
}

function tokenize(text: string): string[] {
  return text
    .replace(/_+/g, " ") // the gap marker itself carries nothing
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .split(/[^a-z'-]+/)
    .map((t) => t.replace(/^[-']+|[-']+$/g, ""))
    .filter((t) => t.length > 0);
}

function isContentWord(token: string): boolean {
  return token.length > 1 && !STOPWORDS.has(token) && !PREPOSITIONS.has(token);
}

// ── Bank shapes ────────────────────────────────────────────────────────────

interface RawItem {
  id?: unknown;
  part?: unknown;
  questionText?: unknown;
  targetSentence?: unknown;
  baseWord?: unknown;
  correctAnswer?: unknown;
}

/** Mirrors `asAnswerArray` in lib/seed.ts. */
function asAnswerArray(correctAnswer: unknown): string[] {
  if (Array.isArray(correctAnswer)) {
    return (correctAnswer as unknown[]).filter((a): a is string => typeof a === "string");
  }
  return typeof correctAnswer === "string" ? [correctAnswer] : [];
}

/** Mirrors the private `wordCount` in lib/grading.ts. */
function wordCount(value: string): number {
  const n = normalizeForMatch(value);
  return n.length === 0 ? 0 : n.split(" ").length;
}

type Severity = "adjunct" | "phrase" | "target";

interface Run {
  tokens: string[]; // the dropped span, in lead-sentence order
  severity: Severity;
  rationale: string;
  finalPosition: boolean;
}

interface Finding {
  id: string;
  questionText: string;
  targetSentence: string;
  answers: string[];
  runs: Run[];
  worstSeverity: Severity;
}

// ── Detection ──────────────────────────────────────────────────────────────

/**
 * Everything the candidate's finished sentence is guaranteed to contain: the
 * fixed frame around the gap, every accepted answer (all optional-word
 * permutations), and the key word printed on the paper.
 */
function coverageStems(item: RawItem, answers: string[]): Set<string> {
  const covered = new Set<string>();
  const add = (text: string) => {
    for (const token of tokenize(text)) covered.add(stem(token));
  };

  if (typeof item.targetSentence === "string") add(item.targetSentence);
  if (typeof item.baseWord === "string") add(item.baseWord);
  for (const answer of answers) {
    for (const permutation of expandOptionalWords(answer)) add(permutation);
  }
  return covered;
}

/**
 * Walk the lead sentence and group consecutive uncovered tokens into spans.
 *
 * Two refinements matter for precision:
 *   - a covered STOPWORD does not break a run ("about [the] interview" stays
 *     one span even when "the" appears in the target frame), because a bare
 *     determiner carries no context;
 *   - a preposition is only pulled into a run when the content word it governs
 *     is also missing, so "about" is not reported on its own.
 */
function findRuns(lead: string, covered: Set<string>): Run[] {
  const tokens = tokenize(lead);
  const missing = tokens.map((t) => !covered.has(stem(t)));

  const runs: Run[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!missing[i] || !isContentWord(tokens[i])) {
      i += 1;
      continue;
    }

    // Extend rightward over missing content words and bridging function words.
    let end = i;
    let j = i;
    while (j < tokens.length) {
      const token = tokens[j];
      if (missing[j] && isContentWord(token)) {
        end = j;
        j += 1;
      } else if (!isContentWord(token) || PREPOSITIONS.has(token)) {
        j += 1; // bridge over a determiner/preposition and keep looking
      } else {
        break; // a covered content word genuinely ends the span
      }
    }

    // Extend leftward to absorb the preposition (and its determiner) governing
    // this span — that preposition is the evidence the span is an adjunct.
    let start = i;
    let prepLed = false;
    let k = i - 1;
    while (k >= 0 && !isContentWord(tokens[k])) {
      if (PREPOSITIONS.has(tokens[k]) && missing[k]) {
        start = k;
        prepLed = true;
        break;
      }
      if (STOPWORDS.has(tokens[k])) {
        k -= 1; // step back over "the"/"a" to reach the preposition
        continue;
      }
      break;
    }

    const span = tokens.slice(start, end + 1);
    const contentCount = span.filter((t, idx) => isContentWord(t) && missing[start + idx]).length;
    const hasAdverbial = span.some((t) => ADVERBIAL_MARKERS.has(t));
    const finalPosition = end >= tokens.length - 1;

    let severity: Severity;
    let rationale: string;
    if (prepLed && contentCount >= 1) {
      severity = "adjunct";
      rationale = `prepositional phrase headed by "${span[0]}"${finalPosition ? ", sentence-final" : ""}`;
    } else if (hasAdverbial) {
      severity = "adjunct";
      rationale = "time/place adverbial";
    } else if (contentCount >= 2) {
      severity = "phrase";
      rationale = `${contentCount} adjacent content words dropped together`;
    } else {
      severity = "target";
      rationale = "single bare content word — expected transformation target";
    }

    runs.push({ tokens: span, severity, rationale, finalPosition });
    i = end + 1;
  }

  return runs;
}

const RANK: Record<Severity, number> = { adjunct: 3, phrase: 2, target: 1 };

/**
 * Content words the answer or the fixed frame introduce that the lead sentence
 * does not have — i.e. evidence that this item performs a lexical paraphrase.
 *
 * This is the discriminator that separates the two look-alike cases. When an
 * item swaps "under any circumstances" for "on no account", the answer brings
 * in a novel word ("account") and the dropped span was plainly absorbed by it.
 * When an item simply forgets "about the interview", the answer introduces no
 * new lexis at all: information left and nothing arrived to carry it. Only the
 * second pattern keeps its HIGH ranking.
 */
function novelLexis(lead: string, target: string, answers: string[]): Set<string> {
  const leadStems = new Set(tokenize(lead).map(stem));
  const novel = new Set<string>();
  const scan = (text: string) => {
    for (const token of tokenize(text)) {
      if (isContentWord(token) && !leadStems.has(stem(token))) novel.add(token);
    }
  };
  scan(target);
  for (const answer of answers) {
    for (const permutation of expandOptionalWords(answer)) scan(permutation);
  }
  return novel;
}

// ── Word-count safety ──────────────────────────────────────────────────────

interface Restoration {
  answer: string;
  current: number;
  restored: number;
  fits: boolean;
}

/**
 * Would putting the dropped span back leave the answer inside the 3–8 word
 * limit the grader enforces? An answer that cannot absorb it needs the item
 * reworked (usually by moving the phrase into the fixed frame of
 * `targetSentence`) rather than simply lengthened.
 */
function restorationCost(answers: string[], runs: Run[]): Restoration[] {
  const extra = runs
    .filter((r) => r.severity !== "target")
    .reduce((sum, r) => sum + r.tokens.length, 0);

  return answers.flatMap((answer) =>
    expandOptionalWords(answer).map((permutation) => {
      const current = wordCount(permutation);
      const restored = current + extra;
      return {
        answer: permutation,
        current,
        restored,
        fits: restored >= MIN_WORDS && restored <= MAX_WORDS,
      };
    })
  );
}

// ── Report ─────────────────────────────────────────────────────────────────

function severityLabel(s: Severity): string {
  if (s === "adjunct") return "DROPPED ADJUNCT";
  if (s === "phrase") return "possible drop";
  return "transformation target";
}

/**
 * Proves the detector still catches the defect it was written for, by running
 * it over `p4-156` exactly as that item was stored before the fix. A silent
 * pass on the live bank is only meaningful if the check can still fail.
 */
function selfTest(): void {
  const regression: RawItem = {
    id: "p4-156 (pre-fix, synthetic)",
    part: 4,
    questionText: "Her composure was the most surprising thing about the interview.",
    targetSentence: "____ was her composure.",
    baseWord: "SURPRISED",
    correctAnswer: "What most surprised me",
  };
  const answers = asAnswerArray(regression.correctAnswer);
  const lead = regression.questionText as string;
  const runs = findRuns(lead, coverageStems(regression, answers));
  const novel = novelLexis(lead, regression.targetSentence as string, answers);

  const hit = runs.find((r) => r.tokens.join(" ") === "about the interview");
  const ok = hit !== undefined && hit.severity === "adjunct" && novel.size === 0;

  console.log("Self-test — the pre-fix p4-156 defect");
  console.log("=".repeat(74));
  console.log(`  lead   : ${lead}`);
  console.log(`  target : ${regression.targetSentence}`);
  console.log(`  answer : "${regression.correctAnswer}"`);
  console.log(`  spans  : ${runs.map((r) => `"${r.tokens.join(" ")}" [${r.severity}]`).join(", ") || "none"}`);
  console.log(`  novel  : ${novel.size === 0 ? "(none — nothing arrived to carry the meaning)" : [...novel].join(", ")}`);
  console.log("");
  if (!ok) {
    console.error('  ✗ FAILED — "about the interview" was not reported as a DROPPED ADJUNCT.');
    console.error("    The detector cannot see the defect it exists to find; the report below");
    console.error("    is not trustworthy.");
    process.exit(1);
  }
  console.log('  ✓ PASSED — "about the interview" reported as a DROPPED ADJUNCT.');
  console.log("");
}

function main(): void {
  const showAll = process.argv.includes("--all");
  selfTest();
  const here = dirname(fileURLToPath(import.meta.url));
  const bankFlag = process.argv.indexOf("--bank");
  const bankPath =
    bankFlag !== -1 && process.argv[bankFlag + 1] !== undefined
      ? resolve(process.cwd(), process.argv[bankFlag + 1])
      : resolve(here, "..", "cpe_use_of_english.json");
  if (bankFlag !== -1) console.log(`Auditing candidate bank: ${bankPath}\n`);

  let items: RawItem[];
  try {
    items = JSON.parse(readFileSync(bankPath, "utf8")) as RawItem[];
  } catch (error) {
    console.error(`✗ Could not parse cpe_use_of_english.json\n  ${(error as Error).message}`);
    process.exit(1);
  }

  const part4 = items.filter((i) => i.part === 4);
  const findings: Finding[] = [];

  for (const item of part4) {
    const id = typeof item.id === "string" ? item.id : "<unknown id>";
    const lead = typeof item.questionText === "string" ? item.questionText : "";
    const target = typeof item.targetSentence === "string" ? item.targetSentence : "";
    const answers = asAnswerArray(item.correctAnswer);
    if (lead === "" || answers.length === 0) continue;

    const rawRuns = findRuns(lead, coverageStems(item, answers));
    if (rawRuns.length === 0) continue;

    // Demote by one tier when the answer brought in replacement lexis: the
    // span was probably absorbed by the paraphrase rather than lost. An adjunct
    // only falls to MEDIUM (adjuncts are rarely the target, so it still wants a
    // look), while a bare multi-word span falls to INFO — that pattern is just
    // a multi-word transformation target, e.g. "really don't mind" giving way
    // to "makes no difference".
    const novel = novelLexis(lead, target, answers);
    const demote: Record<Severity, Severity> = { adjunct: "phrase", phrase: "target", target: "target" };
    const runs: Run[] =
      novel.size === 0
        ? rawRuns
        : rawRuns.map((r) => ({
            ...r,
            severity: demote[r.severity],
            rationale:
              `${r.rationale}; answer introduces new lexis ` +
              `(${[...novel].slice(0, 4).map((w) => `"${w}"`).join(", ")}) that may absorb it`,
          }));

    const worst = runs.reduce<Severity>(
      (acc, r) => (RANK[r.severity] > RANK[acc] ? r.severity : acc),
      "target"
    );
    findings.push({ id, questionText: lead, targetSentence: target, answers, runs, worstSeverity: worst });
  }

  findings.sort((a, b) => RANK[b.worstSeverity] - RANK[a.worstSeverity] || a.id.localeCompare(b.id));

  const high = findings.filter((f) => f.worstSeverity === "adjunct");
  const medium = findings.filter((f) => f.worstSeverity === "phrase");
  const targetsOnly = findings.filter((f) => f.worstSeverity === "target");

  console.log("Part 4 context-loss audit");
  console.log("=".repeat(74));
  console.log(`  ${part4.length} Part 4 items scanned`);
  console.log(`  ${high.length} HIGH   — adjunct dropped, answer introduces no replacement lexis`);
  console.log(`  ${medium.length} MEDIUM — material dropped, but a paraphrase may absorb it`);
  console.log(
    `  ${targetsOnly.length} INFO   — single bare content word missing (expected paraphrase target)` +
      (showAll ? "" : ", hidden; pass --all")
  );
  console.log("");

  const render = (list: Finding[]) => {
    for (const f of list) {
      console.log("-".repeat(74));
      console.log(`  ${f.id}`);
      console.log(`    lead    : ${f.questionText}`);
      console.log(`    target  : ${f.targetSentence}`);
      for (const [idx, a] of f.answers.entries()) {
        console.log(`    answer${f.answers.length > 1 ? ` ${idx + 1}` : " "}: "${a}"`);
      }
      for (const run of f.runs) {
        console.log(`    DROPPED : "${run.tokens.join(" ")}"  [${severityLabel(run.severity)}]`);
        console.log(`              ${run.rationale}`);
      }

      const costs = restorationCost(f.answers, f.runs);
      if (costs.some((c) => c.restored !== c.current)) {
        console.log("    restore :");
        for (const c of costs) {
          const verdict = c.fits
            ? `fits (${c.restored}/${MAX_WORDS})`
            : `EXCEEDS LIMIT (${c.restored} > ${MAX_WORDS}) — needs a reworked frame`;
          console.log(`              ${c.current} -> ${c.restored} words, ${verdict}   "${c.answer}"`);
        }
      }
    }
  };

  if (high.length > 0) {
    console.log("HIGH — context absent from the answer, the frame and any paraphrase");
    console.log("");
    render(high);
    console.log("-".repeat(74));
  } else {
    console.log("HIGH — none. No item drops an adjunct without offering replacement lexis.");
  }

  if (medium.length > 0) {
    console.log("");
    console.log("MEDIUM — dropped material that a lexical paraphrase may already cover");
    console.log("");
    render(medium);
    console.log("-".repeat(74));
  }

  if (showAll && targetsOnly.length > 0) {
    console.log("");
    console.log("INFORMATIONAL — single missing content words (normal for Part 4)");
    console.log("");
    render(targetsOnly);
    console.log("-".repeat(74));
  }

  console.log("");
  console.log("Read-only: nothing was written. Confirm each hit by hand — a phrase that");
  console.log("was legitimately paraphrased away can look identical to one that was dropped.");
  process.exit(0);
}

main();
