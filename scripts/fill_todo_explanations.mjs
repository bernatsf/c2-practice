/**
 * Replaces the placeholder explanations left behind by the scraped imports.
 *
 * A batch of items entered the bank from external sources carrying
 * `"explanation": "TODO: add explanation"`. Nothing catches that: the JSON
 * parses, the validator passes and the app builds, but the learner is shown a
 * literal TODO instead of the trap the item is testing — which is the entire
 * pedagogical point of this bank.
 *
 * The replacements are hand-authored in `scripts/data/todo_explanations.json`,
 * keyed by item id, and follow the house style: sentence one gives the rule,
 * the fixed collocation or the phrasal-verb mechanics; sentence two names the
 * Catalan/Spanish false friend, literal-translation trap or dropped particle
 * that pulls learners towards the wrong answer, where one exists.
 *
 * This script only wires them in, and refuses to write on any mismatch.
 *
 *   node scripts/fill_todo_explanations.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BANK = resolve(HERE, "..", "cpe_use_of_english.json");
const AUTHORED = resolve(HERE, "data", "todo_explanations.json");

const dryRun = process.argv.includes("--dry-run");
const errors = [];
const fail = (msg) => errors.push(msg);

const bank = JSON.parse(readFileSync(BANK, "utf8"));
const authored = JSON.parse(readFileSync(AUTHORED, "utf8"));

const isPlaceholder = (q) => String(q.explanation ?? "").includes("TODO");
const targets = bank.filter(isPlaceholder);
const targetIds = new Set(targets.map((q) => q.id));

// Coverage must be exact in both directions: no placeholder left unwritten,
// and no authored entry aimed at an item that does not need it.
for (const q of targets) {
  if (!(q.id in authored)) fail(`${q.id}: still a placeholder but has no authored explanation`);
}
for (const id of Object.keys(authored)) {
  if (!targetIds.has(id)) fail(`${id}: authored but that item is not a placeholder`);
}

// Each replacement must actually be an explanation, not another placeholder.
for (const [id, text] of Object.entries(authored)) {
  if (typeof text !== "string" || text.trim().length < 40) {
    fail(`${id}: explanation missing or implausibly short`);
    continue;
  }
  if (text.includes("TODO")) fail(`${id}: replacement still contains "TODO"`);
  // House style is one or two sentences; flag anything that has run away.
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z'"])/).length;
  if (sentences > 3) fail(`${id}: ${sentences} sentences — house style is 1–2`);
}

let filled = 0;
if (errors.length === 0) {
  for (const q of bank) {
    if (isPlaceholder(q)) {
      q.explanation = authored[q.id];
      filled += 1;
    }
  }
  // Nothing may survive the pass.
  const left = bank.filter(isPlaceholder).map((q) => q.id);
  if (left.length) fail(`${left.length} placeholder(s) survived: ${left.slice(0, 10).join(", ")}`);
}

const byPart = {};
for (const q of targets) byPart[q.part] = (byPart[q.part] ?? 0) + 1;

console.log(`placeholders found : ${targets.length}`);
console.log(`by part            : ${JSON.stringify(byPart)}`);
console.log(`authored           : ${Object.keys(authored).length}`);

if (errors.length) {
  console.error(`\n${errors.length} failure(s) — bank NOT written:\n`);
  for (const e of errors.slice(0, 40)) console.error(`  - ${e}`);
  process.exit(1);
}

if (dryRun) {
  console.log(`\ndry run: would fill ${filled} explanations.`);
  process.exit(0);
}

writeFileSync(BANK, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
console.log(`\nfilled ${filled} explanations; 0 placeholders remain.`);
