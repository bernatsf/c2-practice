/**
 * Expands the Part 1 bank so that every *distractor* of a high-value item also
 * gets its own question, with the same four options and a new key.
 *
 * Rationale: a candidate who can pick "actual" out of
 * {actual, current, topical, punctual} has learned one word. Turning each of
 * the other three into the key over the same option set forces the whole
 * quartet apart, which is where the marks actually are.
 *
 * SCOPE — deliberately narrow. Only `part: 1` items whose category is
 * "False Friend" or "Lexical". "Preposition", "Phrasal Verb" and "Grammar"
 * are skipped: inverting those yields generic grammar filler, not lexical
 * discrimination.
 *
 * This script does the MECHANICS only — filtering, coverage accounting, id
 * assignment, validation and the append. The questions themselves are
 * hand-authored in `scripts/data/part1_distractors.json`, because a script
 * cannot write a C2 stem that actually discriminates between four near
 * synonyms. Every authored row is checked against the source item here, and
 * the script refuses to write the bank if a single check fails.
 *
 *   node scripts/expand_part1_distractors.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BANK = resolve(HERE, "..", "cpe_use_of_english.json");
const AUTHORED = resolve(HERE, "data", "part1_distractors.json");

const IN_SCOPE = new Set(["False Friend", "Lexical"]);
const OUT_OF_SCOPE = new Set(["Preposition", "Phrasal Verb", "Grammar"]);

const dryRun = process.argv.includes("--dry-run");
const errors = [];
const fail = (msg) => errors.push(msg);

// ── Load ───────────────────────────────────────────────────────────────────

const bank = JSON.parse(readFileSync(BANK, "utf8"));
const authored = JSON.parse(readFileSync(AUTHORED, "utf8"));

/** @type {Record<string, {reason: string, answers: string[]}>} */
const skips = authored.skipped ?? {};
const rows = authored.items ?? [];

// ── 1. Filter the target items ─────────────────────────────────────────────

const part1 = bank.filter((q) => q.part === 1);
const sources = part1.filter((q) => IN_SCOPE.has(q.category));

// Guard the filter itself rather than trusting it: an item that is neither in
// scope nor in the known out-of-scope set means the bank grew a new category
// and this script's assumptions need revisiting.
for (const q of part1) {
  if (!IN_SCOPE.has(q.category) && !OUT_OF_SCOPE.has(q.category)) {
    fail(`${q.id}: unrecognised category ${JSON.stringify(q.category)} — extend the scope sets`);
  }
}

const byId = new Map(sources.map((q) => [q.id, q]));

const norm = (s) => String(s).trim().toLowerCase();
const stemKey = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** The three options of a source item that are not its key. */
function distractorsOf(q) {
  return q.options.filter((o) => norm(o) !== norm(q.correctAnswer));
}

for (const q of sources) {
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    fail(`${q.id}: source has ${q.options?.length} options, expected 4`);
  } else if (distractorsOf(q).length !== 3) {
    fail(`${q.id}: source key ${JSON.stringify(q.correctAnswer)} does not leave exactly 3 distractors`);
  }
}

// ── 2. Check coverage: every distractor is authored or explicitly skipped ───

const authoredBySource = new Map();
for (const row of rows) {
  if (!authoredBySource.has(row.source)) authoredBySource.set(row.source, []);
  authoredBySource.get(row.source).push(row);
}

for (const [id, skip] of Object.entries(skips)) {
  if (!byId.has(id)) fail(`skipped: ${id} is not an in-scope source item`);
  if (!skip.reason) fail(`skipped: ${id} has no reason`);
}

for (const q of sources) {
  const wanted = distractorsOf(q).map(norm);
  const got = (authoredBySource.get(q.id) ?? []).map((r) => norm(r.answer));
  const skip = skips[q.id];
  const excused = new Set((skip?.answers ?? []).map(norm));

  if (skip && !skip.answers) {
    // Whole item skipped.
    if (got.length) fail(`${q.id}: skipped wholesale but has ${got.length} authored rows`);
    continue;
  }

  for (const d of wanted) {
    const covered = got.includes(d) || excused.has(d);
    if (!covered) fail(`${q.id}: distractor ${JSON.stringify(d)} is neither authored nor skipped`);
  }
  for (const g of got) {
    if (!wanted.includes(g)) {
      fail(`${q.id}: authored answer ${JSON.stringify(g)} is not a distractor of that item`);
    }
    if (excused.has(g)) fail(`${q.id}: ${JSON.stringify(g)} is both authored and skipped`);
  }
  const dupes = got.filter((g, i) => got.indexOf(g) !== i);
  if (dupes.length) fail(`${q.id}: duplicate authored answers ${JSON.stringify([...new Set(dupes)])}`);
}

// ── 3. Validate and build each new item ────────────────────────────────────

// Every stem already in the bank, so a new one cannot silently duplicate it.
const seenStems = new Map();
for (const q of bank) {
  if (typeof q.questionText === "string") seenStems.set(stemKey(q.questionText), q.id);
}

const maxP1 = part1.reduce((max, q) => {
  const n = Number.parseInt(String(q.id).slice(3), 10);
  return Number.isFinite(n) && n > max ? n : max;
}, 0);

let next = maxP1;
const built = [];

for (const row of rows) {
  const src = byId.get(row.source);
  const where = `${row.source}/${row.answer}`;

  if (!src) {
    fail(`${where}: source id not found among in-scope items`);
    continue;
  }

  const { questionText, explanation, answer } = row;

  if (typeof questionText !== "string" || !questionText.trim()) {
    fail(`${where}: missing questionText`);
    continue;
  }
  if (typeof explanation !== "string" || !explanation.trim()) {
    fail(`${where}: missing explanation`);
    continue;
  }

  // Exactly one gap.
  const gaps = questionText.match(/____/g) ?? [];
  if (gaps.length !== 1) {
    fail(`${where}: stem has ${gaps.length} gaps, expected exactly 1`);
  }
  if (/_____+/.test(questionText)) {
    fail(`${where}: gap is longer than the canonical four underscores`);
  }

  // The key must resolve against the option text exactly once — this is the
  // silent fallback in lib/seed.ts (`correct?.key ?? "A"`) that turns a typo
  // into "option A is correct" with no error anywhere.
  const hits = src.options.filter((o) => norm(o) === norm(answer));
  if (hits.length !== 1) {
    fail(`${where}: answer matches ${hits.length} of ${JSON.stringify(src.options)}`);
    continue;
  }
  if (norm(answer) === norm(src.correctAnswer)) {
    fail(`${where}: answer is the source's own key, not a distractor`);
  }

  // The answer must not be sitting in its own stem.
  const bare = String(answer).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(^|[^\\p{L}-])${bare}([^\\p{L}-]|$)`, "iu").test(questionText)) {
    fail(`${where}: the answer appears in its own stem`);
  }

  // A brand-new explanation, not the source's.
  if (stemKey(explanation) === stemKey(src.explanation)) {
    fail(`${where}: explanation is copied verbatim from ${src.id}`);
  }

  const key = stemKey(questionText);
  if (seenStems.has(key)) {
    fail(`${where}: stem duplicates ${seenStems.get(key)}`);
  } else {
    seenStems.set(key, `new(${where})`);
  }

  next += 1;
  built.push({
    id: `p1-${next}`,
    part: 1,
    category: src.category,
    questionText,
    // Exact same four words, exact same order, as required.
    options: [...src.options],
    baseWord: null,
    targetSentence: null,
    correctAnswer: hits[0],
    explanation,
  });
}

// Ids must not collide with anything already in the bank.
const existingIds = new Set(bank.map((q) => q.id));
for (const item of built) {
  if (existingIds.has(item.id)) fail(`${item.id}: id already exists in the bank`);
}

// ── 4. Report, then write only on a clean run ──────────────────────────────

const skippedAnswers = Object.values(skips).reduce(
  (n, s) => n + (s.answers ? s.answers.length : 3),
  0,
);

console.log(`part 1 items in bank      : ${part1.length}`);
console.log(`in scope (FF + Lexical)   : ${sources.length}`);
console.log(`out of scope, skipped     : ${part1.length - sources.length}`);
console.log(`distractors available     : ${sources.length * 3}`);
console.log(`authored                  : ${built.length}`);
console.log(`deliberately skipped      : ${skippedAnswers}`);

if (errors.length) {
  console.error(`\n${errors.length} validation failure(s) — bank NOT written:\n`);
  for (const e of errors.slice(0, 60)) console.error(`  - ${e}`);
  if (errors.length > 60) console.error(`  ... and ${errors.length - 60} more`);
  process.exit(1);
}

if (built.length !== sources.length * 3 - skippedAnswers) {
  console.error("\nCoverage arithmetic does not add up — bank NOT written.");
  process.exit(1);
}

if (dryRun) {
  console.log(`\ndry run: would append ${built.length} items (p1-${maxP1 + 1} … p1-${next}).`);
  process.exit(0);
}

writeFileSync(BANK, `${JSON.stringify([...bank, ...built], null, 2)}\n`, "utf8");
console.log(`\nappended ${built.length} items: p1-${maxP1 + 1} … p1-${next}`);
