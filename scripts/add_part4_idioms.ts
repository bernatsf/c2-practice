/**
 * Appends the Part 4 "pure idiom" batch to `cpe_use_of_english.json`.
 *
 * 100 items, each forcing a C2 idiom, fixed phrase or opaque phrasal verb. The
 * items are hand-authored in `scripts/data/part4_idiom_*.json`; this script does
 * the MECHANICS only and refuses to write the bank if a single check fails.
 *
 *   npx tsx scripts/add_part4_idioms.ts --dry-run
 *   npx tsx scripts/add_part4_idioms.ts
 *
 * Word counting and the key-word test import `normalizeForMatch` and
 * `expandOptionalWords` from `lib/grading.ts` rather than reimplementing them,
 * so this cannot drift from the code that actually marks answers. The key-word
 * test mirrors `validate_question_bank.ts` exactly: a whole-token match, so
 * "prides" does NOT satisfy the key word PRIDE.
 *
 * CONTEXT LOSS IS NOT CHECKED HERE, DELIBERATELY.
 * `scripts/audit_part4_context.ts` already owns that problem, and owns it far
 * better: it demotes a dropped span when the answer introduces replacement
 * lexis, which is the normal case for an idiom batch ("in constant
 * disagreement" legitimately vanishing into "at loggerheads over"). A second,
 * cruder detector here would only drift from it. So `--dry-run` writes a merged
 * candidate bank to a temp path and the real audit is pointed at that with
 * `--bank`, before anything touches the live file.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expandOptionalWords, normalizeForMatch } from "../lib/grading";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");
const BANK = resolve(HERE, "..", "cpe_use_of_english.json");
const STAGED = join(DATA, "part4_idiom_batch.json");

const dryRun = process.argv.includes("--dry-run");

const MIN_WORDS = 3;
const MAX_WORDS = 8;

const CANONICAL_KEYS = [
  "id", "part", "category", "questionText", "options",
  "baseWord", "targetSentence", "correctAnswer", "explanation",
];
const CATEGORIES = new Set(["False Friend", "Phrasal Verb", "Preposition", "Lexical", "Grammar"]);

/**
 * The batch is specified as PURE IDIOM: no inversions, conditionals, cleft
 * sentences or passive reporting. These patterns are what those structures look
 * like in an answer key, and any hit fails the run rather than being reported.
 */
const GRAMMAR_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "negative-adverbial inversion", re: /^(no sooner|not until|never before|little did|hardly|scarcely|barely|seldom|rarely|nowhere|under no|on no|at no|in no way)\b/ },
  { name: "focusing inversion", re: /^only (when|after|by|if|then|once|in|with)\b/ },
  { name: "such/so inversion", re: /^(such (was|is|were)|so \w+ (was|is|were))\b/ },
  { name: "inverted conditional", re: /^(had|were|should) (the|he|she|it|they|i|we|you|there)\b/ },
  { name: "cleft sentence", re: /^(it (was|is) .+ that\b|what .+ (was|is)$)/ },
  { name: "passive reporting", re: /\b(is|are|was|were) (said|believed|thought|reported|claimed|alleged|rumoured|rumored|expected|understood|considered|feared|known|alleged) to\b/ },
];

interface Item {
  id: string; part: number; category: string; questionText: string;
  options: null; baseWord: string; targetSentence: string;
  correctAnswer: string | string[]; explanation: string;
}

const errors: string[] = [];
const fail = (id: string, msg: string) => errors.push(`${id}: ${msg}`);

// ── Load ───────────────────────────────────────────────────────────────────

const bank = JSON.parse(readFileSync(BANK, "utf8")) as Item[];
const chunkFiles = readdirSync(DATA).filter((f) => /^part4_idiom_\d+\.json$/.test(f)).sort();
if (chunkFiles.length === 0) {
  console.error("No part4_idiom_*.json chunks in scripts/data — nothing to stage.");
  process.exit(1);
}

const buffer: Item[] = [];
for (const f of chunkFiles) buffer.push(...(JSON.parse(readFileSync(join(DATA, f), "utf8")) as Item[]));
console.log(`Staged ${buffer.length} candidates from ${chunkFiles.length} chunks: ${chunkFiles.join(", ")}`);

const answersOf = (a: unknown): string[] =>
  Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : typeof a === "string" ? [a] : [];
const normLead = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

const bankIds = new Set(bank.map((q) => q.id));
const bankLeads = new Map<string, string>();
const bankPairs = new Set<string>();
for (const q of bank) {
  if (typeof q.questionText === "string") bankLeads.set(normLead(q.questionText), q.id);
  if (q.part === 4) for (const a of answersOf(q.correctAnswer)) bankPairs.add(`${q.baseWord}|${a.toLowerCase()}`);
}
const maxP4 = Math.max(...bank.filter((q) => q.part === 4).map((q) => Number(String(q.id).split("-")[1]) || 0));
const fmtId = (n: number) => `p4-${n < 100 ? String(n).padStart(2, "0") : n}`;
console.log(`Bank holds ${bank.length} items; highest Part 4 id is ${fmtId(maxP4)}.`);

// ── Checks ─────────────────────────────────────────────────────────────────

const seenIds = new Set<string>();
const seenLeads = new Map<string, string>();
const seenPairs = new Set<string>();

buffer.forEach((item, i) => {
  const id = typeof item.id === "string" ? item.id : `<index ${i}>`;
  const expectedId = fmtId(maxP4 + 1 + i);

  const keys = Object.keys(item);
  if (keys.length !== CANONICAL_KEYS.length || keys.some((k, j) => k !== CANONICAL_KEYS[j])) {
    fail(id, `keys must be exactly ${CANONICAL_KEYS.join(", ")} — got ${keys.join(", ")}`);
  }
  if (item.part !== 4) fail(id, `part must be 4, got ${JSON.stringify(item.part)}`);
  if (item.options !== null) fail(id, "options must be null for Part 4");
  if (!CATEGORIES.has(item.category)) fail(id, `category ${JSON.stringify(item.category)} is not one of the five allowed`);
  if (typeof item.explanation !== "string" || item.explanation.trim() === "") fail(id, "explanation must be a non-empty string");
  if (typeof item.questionText !== "string" || item.questionText.trim() === "") fail(id, "questionText (lead sentence) must be a non-empty string");
  if (typeof item.baseWord !== "string" || !/^[A-Z]+$/.test(item.baseWord)) {
    fail(id, `baseWord must be an ALL CAPS key word, got ${JSON.stringify(item.baseWord)}`);
  }

  if (item.id !== expectedId) fail(id, `id must continue the sequence: expected ${expectedId}`);
  if (bankIds.has(item.id)) fail(id, "id already exists in the bank");
  if (seenIds.has(item.id)) fail(id, "duplicate id within the batch");
  seenIds.add(item.id);

  const key = typeof item.baseWord === "string" ? normalizeForMatch(item.baseWord.trim()) : "";

  // targetSentence: exactly one gap, and the key word must NOT be printed in it.
  if (typeof item.targetSentence !== "string" || item.targetSentence.trim() === "") {
    fail(id, "targetSentence must be a non-empty string containing the gap");
  } else {
    const gaps = (item.targetSentence.match(/____/g) ?? []).length;
    if (gaps !== 1) fail(id, `targetSentence must contain exactly one "____", found ${gaps}`);
    if (key !== "" && normalizeForMatch(item.targetSentence).split(" ").includes(key)) {
      fail(id, `key word "${item.baseWord}" appears in targetSentence — the candidate never has to produce it (the p4-38 trap)`);
    }
  }

  const answers = answersOf(item.correctAnswer);
  if (answers.length === 0) fail(id, "correctAnswer must be a string or a non-empty string[]");

  for (const answer of answers) {
    for (const permutation of expandOptionalWords(answer)) {
      const normalised = normalizeForMatch(permutation);
      const words = normalised === "" ? 0 : normalised.split(" ").length;

      if (words < MIN_WORDS || words > MAX_WORDS) {
        fail(id, `answer "${permutation}" is ${words} words — outside ${MIN_WORDS}-${MAX_WORDS}, so grading.ts makes the item unanswerable`);
      }
      // Exactly the comparison validate_question_bank.ts makes.
      if (key !== "" && !normalised.split(" ").includes(key)) {
        fail(id, `answer "${permutation}" does not contain the key word "${item.baseWord}" as a whole word`);
      }
      for (const { name, re } of GRAMMAR_PATTERNS) {
        if (re.test(normalised)) fail(id, `answer "${permutation}" is a ${name} — this batch is specified as pure idiom, no grammar`);
      }
    }

    const pair = `${item.baseWord}|${answer.toLowerCase()}`;
    if (bankPairs.has(pair)) fail(id, `key word + answer "${item.baseWord} > ${answer}" already in the bank`);
    if (seenPairs.has(pair)) fail(id, `key word + answer "${item.baseWord} > ${answer}" duplicated in the batch`);
    seenPairs.add(pair);
  }

  if (typeof item.questionText === "string") {
    const norm = normLead(item.questionText);
    if (bankLeads.has(norm)) fail(id, `lead sentence duplicates bank item ${bankLeads.get(norm)}`);
    if (seenLeads.has(norm)) fail(id, `lead sentence duplicates batch item ${seenLeads.get(norm)}`);
    seenLeads.set(norm, item.id);

  }
});

// ── Verdict ────────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`\nREFUSING TO WRITE — ${errors.length} validation failure(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(`All ${buffer.length} candidates passed every mechanical check.`);
console.log(`Distinct key words: ${new Set(buffer.map((i) => i.baseWord)).size}`);

writeFileSync(STAGED, `${JSON.stringify(buffer, null, 2)}\n`, "utf8");
console.log(`Staged buffer written to ${STAGED}`);

const merged = [...bank, ...buffer];

if (dryRun) {
  // A candidate bank the real context auditor can be pointed at without the
  // live file ever being touched.
  const candidate = join(DATA, "part4_candidate_bank.json");
  writeFileSync(candidate, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`Candidate bank written to ${candidate}`);
  console.log(`Next: npx tsx scripts/audit_part4_context.ts --bank ${candidate}`);
  console.log("--dry-run: live bank not modified.");
  process.exit(0);
}

writeFileSync(BANK, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(`Appended ${buffer.length} items — bank now holds ${merged.length}.`);
