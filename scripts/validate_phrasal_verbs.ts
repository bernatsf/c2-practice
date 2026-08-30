/**
 * Structural validator for `data/phrasal_verbs.json`.
 *
 * Like the question-bank validator, every check guards a fault that is
 * invisible on inspection — the JSON parses, `tsc` passes, the app builds, and
 * an individual drill item is still broken at runtime:
 *
 *   IDS      — must be unique. `cpe.phrasal.srs` is keyed by id, so duplicates
 *              would share one SM-2 schedule: answering one verb would mark
 *              another as reviewed.
 *
 *   ROOT     — must be uppercase and must be the first word of the target. The
 *              Root Matrix files items by `root`; a mismatch puts a verb under
 *              a root that never appears in its own answer, so filtering to
 *              that root drills something else.
 *
 *   TARGET   — brackets must balance and the target must reduce to at least two
 *              words. An unbalanced bracket silently swallows the rest of the
 *              string in `acceptedForms`, leaving an item that cannot be
 *              answered correctly by anyone.
 *
 *   ANSWERS  — the core form (all markers stripped) must itself be an accepted
 *              form. This is the whole promise of the drill: the learner types
 *              "get down", not "get [sb] down". It has to be checked through
 *              the REAL grader, not a copy of its rules.
 *
 *   PROSE    — definition and translation must be non-empty, and the
 *              translation must carry the " / " that separates the Spanish
 *              gloss from the Catalan one. A missing half is not visible in the
 *              UI — it just silently teaches one language.
 *
 * The accepted-form checks import `acceptedForms`, `coreForm` and
 * `normalizeForPhrasalMatch` from `lib/phrasal.ts` rather than reimplementing
 * them, so this script cannot drift from the code that marks answers.
 *
 * Run with `npm test`; also runs as part of `npm run build`.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { acceptedForms, coreForm, normalizeForPhrasalMatch } from "../lib/phrasal";

interface RawPhrasal {
  id?: unknown;
  root?: unknown;
  target?: unknown;
  definition?: unknown;
  translation?: unknown;
}

interface Violation {
  check: string;
  id: string;
  lines: string[];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function idOf(item: RawPhrasal): string {
  return typeof item.id === "string" ? item.id : "<unknown id>";
}

function checkUniqueIds(items: RawPhrasal[], out: Violation[]): number {
  const counts = new Map<string, number>();
  for (const item of items) {
    const id = idOf(item);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    if (count > 1) {
      out.push({
        check: "IDS",
        id,
        lines: [
          `appears ${count} times — ids must be unique`,
          "-> cpe.phrasal.srs is keyed by id, so duplicates share one SM-2 schedule.",
        ],
      });
    }
  }
  return counts.size;
}

function checkItem(item: RawPhrasal, out: Violation[]): void {
  const id = idOf(item);
  const root = str(item.root);
  const target = str(item.target);
  const definition = str(item.definition);
  const translation = str(item.translation);

  if (!/^[A-Z]+$/.test(root)) {
    out.push({ check: "ROOT", id, lines: [`root "${root}" must be uppercase A–Z`] });
  }
  if (target.trim() === "") {
    out.push({ check: "TARGET", id, lines: ["has an empty target"] });
    return; // every check below reads the target
  }

  const firstWord = target.trim().split(/\s+/)[0].toLowerCase();
  if (root !== "" && firstWord !== root.toLowerCase()) {
    out.push({
      check: "ROOT",
      id,
      lines: [
        `target "${target}" starts with "${firstWord}" but is filed under root "${root}"`,
        "-> the Root Matrix would drill this verb under a root it does not contain.",
      ],
    });
  }

  const opens = (target.match(/\[/g) ?? []).length;
  const closes = (target.match(/\]/g) ?? []).length;
  if (opens !== closes) {
    out.push({
      check: "TARGET",
      id,
      lines: [
        `unbalanced brackets in "${target}" (${opens} "[" vs ${closes} "]")`,
        "-> acceptedForms() would swallow the rest of the string, making the item unanswerable.",
      ],
    });
  }

  const core = coreForm(target);
  if (core.split(" ").filter((w) => w !== "").length < 2) {
    out.push({
      check: "TARGET",
      id,
      lines: [`"${target}" reduces to "${core}" — a phrasal verb needs a verb and a particle`],
    });
  }

  const forms = acceptedForms(target);
  if (forms.length === 0) {
    out.push({ check: "ANSWERS", id, lines: [`"${target}" produces no accepted form`] });
  } else if (!forms.includes(normalizeForPhrasalMatch(core))) {
    out.push({
      check: "ANSWERS",
      id,
      lines: [
        `core form "${core}" is not accepted for target "${target}"`,
        `accepted: ${forms.map((f) => `"${f}"`).join(", ")}`,
        "-> the drill promises that stripping [markers] is enough to answer.",
      ],
    });
  }

  if (definition.trim() === "") {
    out.push({ check: "PROSE", id, lines: ["has an empty definition — nothing would be shown"] });
  }
  if (translation.trim() === "") {
    out.push({ check: "PROSE", id, lines: ["has an empty translation"] });
  } else if (!translation.includes(" / ")) {
    out.push({
      check: "PROSE",
      id,
      lines: [
        `translation "${translation}" has no " / " separating the Spanish gloss from the Catalan`,
      ],
    });
  }
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const bankPath = resolve(here, "..", "data", "phrasal_verbs.json");

  let items: RawPhrasal[];
  try {
    items = JSON.parse(readFileSync(bankPath, "utf8")) as RawPhrasal[];
  } catch (error) {
    console.error(`✗ Could not parse data/phrasal_verbs.json\n  ${(error as Error).message}`);
    process.exit(1);
  }

  if (!Array.isArray(items) || items.length === 0) {
    console.error("✗ data/phrasal_verbs.json did not contain a non-empty array.");
    process.exit(1);
  }

  const violations: Violation[] = [];
  const uniqueIds = checkUniqueIds(items, violations);
  for (const item of items) checkItem(item, violations);

  if (violations.length > 0) {
    const byCheck = new Map<string, Violation[]>();
    for (const v of violations) {
      const list = byCheck.get(v.check) ?? [];
      list.push(v);
      byCheck.set(v.check, list);
    }
    console.error(`\n✗ ${violations.length} violation(s) found:\n`);
    for (const [check, list] of byCheck) {
      console.error(`── ${check} (${list.length}) ${"─".repeat(Math.max(0, 46 - check.length))}`);
      for (const v of list) {
        console.error(`  ${v.id}`);
        for (const line of v.lines) console.error(`    ${line}`);
      }
      console.error("");
    }
    console.error("Phrasal verb bank validation FAILED.");
    process.exit(1);
  }

  const roots = new Set(items.map((i) => str(i.root)));
  const forms = items.reduce((n, i) => n + acceptedForms(str(i.target)).length, 0);
  console.log("✓ Phrasal verb bank validation passed");
  console.log(`    ${items.length} verbs, ${uniqueIds} unique ids, ${roots.size} roots`);
  console.log(`    ${forms} accepted answer forms — every core form marks correct`);
  process.exit(0);
}

main();
