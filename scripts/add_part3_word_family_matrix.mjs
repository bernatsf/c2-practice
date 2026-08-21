/**
 * Appends the Part 3 "morphological matrix" batch to `cpe_use_of_english.json`.
 *
 * 50 high-yield roots x 3 advanced derivations each. The questions themselves are
 * hand-authored in `scripts/data/part3_matrix_*.json`, because a script cannot
 * write a C2 stem whose context actually forces one derivation and rejects its
 * siblings. This script does the MECHANICS only — merging the chunks into a
 * single staged buffer, then schema, word-count, derivation, stem and uniqueness
 * checking — and it refuses to write the bank if a single check fails.
 *
 *   node scripts/add_part3_word_family_matrix.mjs --dry-run
 *   node scripts/add_part3_word_family_matrix.mjs --polarity-reviewed
 *
 * The polarity gate is deliberate. Whether a stem demands `un-`/`in-`/`dis-`/
 * `mis-`/`over-`/`under-` is a fact about sentence MEANING, which no check here
 * can decide; the script prints a review table and will not write until the
 * author has read it and passed --polarity-reviewed.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");
const BANK = resolve(HERE, "..", "cpe_use_of_english.json");
const STAGED = join(DATA, "part3_word_family_matrix.json");

const dryRun = process.argv.includes("--dry-run");
const polarityReviewed = process.argv.includes("--polarity-reviewed");

const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);

const CANONICAL_KEYS = [
  "id", "part", "category", "questionText", "options",
  "baseWord", "targetSentence", "correctAnswer", "explanation",
];

/**
 * Declared stem mutations. A derivation normally contains the first five
 * characters of its base; these roots reshape the stem before suffixation, so
 * the allomorph is declared here rather than waved through by a loose check.
 */
const MUTATIONS = {
  APPEAR: ["appar"],        // appear   > apparent, apparition
  RECEIVE: ["recip", "recept"], // receive > recipient, receptive
  SPEAK: ["spok", "speech"],    // speak   > spokesperson, speechless
  SUSPECT: ["suspic"],      // suspect  > suspicion
  VARY: ["vari"],           // vary     > variance, invariably
  SENSE: ["sens"],          // sense    > sensory, nonsensical
  PROVE: ["prov"],          // prove    > proven, provable
};

/**
 * Negative / privative / degree prefixes. A prefix only counts as ADDED when the
 * base does not already begin with it: DEFEND > "defensive" is not a negation,
 * and INTELLIGENT > "intelligence" is not an "in-" either.
 */
const POLARITY_PREFIXES = ["un", "im", "il", "ir", "in", "dis", "mis", "non", "over", "under", "a"];

function addedPolarityPrefix(answer, base) {
  const a = answer.toLowerCase().replace(/-/g, "");
  const b = base.toLowerCase();
  for (const p of POLARITY_PREFIXES) {
    if (a.startsWith(p) && !b.startsWith(p)) return `${p}-`;
  }
  return "";
}

// ── Load ───────────────────────────────────────────────────────────────────

const bank = JSON.parse(readFileSync(BANK, "utf8"));

const chunkFiles = readdirSync(DATA)
  .filter((f) => /^part3_matrix_\d+\.json$/.test(f))
  .sort();

if (chunkFiles.length === 0) {
  console.error("No part3_matrix_*.json chunks found in scripts/data — nothing to stage.");
  process.exit(1);
}

/** The in-memory buffer: every candidate, in chunk order. */
const buffer = [];
for (const file of chunkFiles) {
  const rows = JSON.parse(readFileSync(join(DATA, file), "utf8"));
  if (!Array.isArray(rows)) {
    console.error(`${file}: expected a top-level array`);
    process.exit(1);
  }
  buffer.push(...rows);
}

console.log(`Staged ${buffer.length} candidates from ${chunkFiles.length} chunks: ${chunkFiles.join(", ")}`);

// ── Bank-side indexes ──────────────────────────────────────────────────────

const normStem = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const answersOf = (a) => (Array.isArray(a) ? a : [a]).filter((x) => typeof x === "string");

const bankIds = new Set(bank.map((q) => q.id));
const bankStems = new Map();
const bankPairs = new Set();
for (const q of bank) {
  if (typeof q.questionText === "string") bankStems.set(normStem(q.questionText), q.id);
  if (q.part === 3) {
    for (const a of answersOf(q.correctAnswer)) {
      bankPairs.add(`${q.baseWord}|${a.toLowerCase()}`);
    }
  }
}

const maxP3 = Math.max(
  ...bank.filter((q) => q.part === 3).map((q) => Number(String(q.id).split("-")[1]) || 0),
);
const fmtId = (n) => `p3-${n < 100 ? String(n).padStart(2, "0") : n}`;

console.log(`Bank holds ${bank.length} items; highest Part 3 id is ${fmtId(maxP3)}.`);

// ── Per-candidate checks ───────────────────────────────────────────────────

const seenIds = new Set();
const seenStems = new Map();
const seenPairs = new Set();
const polarityRows = [];

buffer.forEach((item, i) => {
  const id = typeof item.id === "string" ? item.id : `<index ${i}>`;
  const expectedId = fmtId(maxP3 + 1 + i);

  // Schema — exactly the nine canonical keys, in order.
  const keys = Object.keys(item);
  if (keys.length !== CANONICAL_KEYS.length || keys.some((k, j) => k !== CANONICAL_KEYS[j])) {
    fail(id, `keys must be exactly ${CANONICAL_KEYS.join(", ")} — got ${keys.join(", ")}`);
  }
  if (item.part !== 3) fail(id, `part must be 3, got ${JSON.stringify(item.part)}`);
  if (item.category !== "Lexical") fail(id, `category must be "Lexical", got ${JSON.stringify(item.category)}`);
  if (item.options !== null) fail(id, "options must be null for Part 3");
  if (item.targetSentence !== null) fail(id, "targetSentence must be null for Part 3");
  if (typeof item.explanation !== "string" || item.explanation.trim() === "") {
    fail(id, "explanation must be a non-empty string");
  }
  if (typeof item.baseWord !== "string" || !/^[A-Z]+$/.test(item.baseWord)) {
    fail(id, `baseWord must be an ALL CAPS lemma, got ${JSON.stringify(item.baseWord)}`);
  }

  // Ids — sequential from the bank maximum, unique here and absent from the bank.
  if (item.id !== expectedId) fail(id, `id must continue the sequence: expected ${expectedId}`);
  if (bankIds.has(item.id)) fail(id, "id already exists in the bank");
  if (seenIds.has(item.id)) fail(id, "duplicate id within the batch");
  seenIds.add(item.id);

  const answers = answersOf(item.correctAnswer);
  if (answers.length === 0) fail(id, "correctAnswer must be a string or a non-empty string[]");

  const base = typeof item.baseWord === "string" ? item.baseWord.toLowerCase() : "";
  const stem5 = base.slice(0, 5);
  const allowed = [stem5, ...(MUTATIONS[item.baseWord] ?? [])].filter(Boolean);

  for (const raw of answers) {
    const a = raw.toLowerCase();

    // Word count — Part 3 is a one-word gap. Hyphens are fine, spaces are not.
    if (/\s/.test(raw)) fail(id, `answer ${JSON.stringify(raw)} contains whitespace — Part 3 answers are one word`);

    // Derivation — not the bare root, and built on the root or a declared allomorph.
    if (a === base) fail(id, `answer ${JSON.stringify(raw)} is the bare baseWord — no derivation`);
    const flat = a.replace(/-/g, "");
    if (!allowed.some((stem) => flat.includes(stem))) {
      fail(id, `answer ${JSON.stringify(raw)} does not derive from ${item.baseWord} (allowed stems: ${allowed.join(", ")})`);
    }

    // The answer must never be handed to the candidate in its own stem.
    if (typeof item.questionText === "string" &&
        new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(item.questionText)) {
      fail(id, `answer ${JSON.stringify(raw)} appears in its own stem`);
    }

    // Pair uniqueness — same root, same derivation, twice over.
    const pair = `${item.baseWord}|${a}`;
    if (bankPairs.has(pair)) fail(id, `baseWord+answer pair "${item.baseWord} > ${raw}" already in the bank`);
    if (seenPairs.has(pair)) fail(id, `baseWord+answer pair "${item.baseWord} > ${raw}" duplicated in the batch`);
    seenPairs.add(pair);
  }

  // Stem — exactly one gap, base word not given away, not a duplicate.
  if (typeof item.questionText !== "string" || item.questionText.trim() === "") {
    fail(id, "questionText must be a non-empty string");
  } else {
    const gaps = (item.questionText.match(/____/g) ?? []).length;
    if (gaps !== 1) fail(id, `questionText must contain exactly one "____", found ${gaps}`);
    if (base && new RegExp(`\\b${base}\\b`, "i").test(item.questionText)) {
      fail(id, `baseWord "${item.baseWord}" appears in its own stem`);
    }
    const norm = normStem(item.questionText);
    if (bankStems.has(norm)) fail(id, `stem duplicates bank item ${bankStems.get(norm)}`);
    if (seenStems.has(norm)) fail(id, `stem duplicates batch item ${seenStems.get(norm)}`);
    seenStems.set(norm, item.id);
  }

  polarityRows.push({
    id: item.id,
    base: item.baseWord,
    answer: answers.join(" / "),
    polarity: addedPolarityPrefix(answers[0] ?? "", item.baseWord ?? "") || "—",
    stem: String(item.questionText ?? "").replace(/\s+/g, " ").slice(0, 84),
  });
});

// ── Polarity review table ──────────────────────────────────────────────────

console.log("\n── Polarity review — meaning cannot be machine-checked, read this ──");
for (const r of polarityRows) {
  console.log(`${r.id.padEnd(8)} ${r.base.padEnd(12)} ${r.answer.padEnd(30)} ${r.polarity.padEnd(8)} ${r.stem}`);
}
const negCount = polarityRows.filter((r) => r.polarity !== "—").length;
console.log(`${polarityRows.length} items — ${negCount} carry a negative/degree prefix, ${polarityRows.length - negCount} do not.`);

// ── Verdict ────────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.error(`\nREFUSING TO WRITE — ${errors.length} validation failure(s):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(`\nAll ${buffer.length} candidates passed every mechanical check.`);

writeFileSync(STAGED, `${JSON.stringify(buffer, null, 2)}\n`, "utf8");
console.log(`Staged buffer written to ${STAGED}`);

if (dryRun) {
  console.log("--dry-run: bank not modified.");
  process.exit(0);
}

if (!polarityReviewed) {
  console.error("\nRefusing to write: polarity table above has not been signed off.");
  console.error("Re-run with --polarity-reviewed once every stem's polarity has been read.");
  process.exit(1);
}

const merged = [...bank, ...buffer];
writeFileSync(BANK, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(`Appended ${buffer.length} items — bank now holds ${merged.length}.`);
