/**
 * Structural validator for `cpe_use_of_english.json`.
 *
 * Each check below guards a defect that is invisible on inspection: the bank
 * still parses, `tsc` still passes and the app still builds, but individual
 * items are silently broken at runtime. Every one of these has happened here.
 *
 *   GLOBAL  — ids must be unique. `lib/localRepository.ts` keys the attempt
 *             log and SRS schedule by question id, so duplicates collide.
 *
 *   PART 1  — `correctAnswer` must match exactly one option. `lib/seed.ts`
 *             resolves the answer against the option TEXT and falls back to
 *             key "A" when nothing matches (`correct?.key ?? "A"`), so a typo
 *             does not throw — it silently marks the first option correct.
 *
 *   PART 2  — answers must be a single word. Part 2 is a one-word gap, so a
 *             multi-word answer can never be produced by a candidate.
 *
 *   PART 4  — answers must be 3–8 words. `lib/grading.ts` rejects anything
 *             outside that range, so a too-short answer makes the item
 *             unanswerable: every candidate gets it wrong whatever they type.
 *             `p4-08` and `p4-10` shipped in exactly that state.
 *
 * Word counting for Part 4 reuses `normalizeForMatch` and
 * `expandOptionalWords` from the grading engine rather than reimplementing
 * them, so this script cannot drift from the code that marks answers:
 * contractions expand before counting ("shouldn't have given" is four words),
 * and optional bracketed words are expanded so that every permutation of
 * "Little did the investors know (that)" is checked independently.
 *
 * Run with `npm test`; also runs as the first step of `npm run build`.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expandOptionalWords, normalizeForMatch } from "../lib/grading";

// Defaults declared on `Question` in lib/types.ts. `lib/seed.ts` does not map
// per-item overrides out of the JSON, so these apply to every Part 4 item.
const MIN_WORDS = 3;
const MAX_WORDS = 8;
const PART1_OPTION_COUNT = 4;

interface RawItem {
  id?: unknown;
  part?: unknown;
  options?: unknown;
  baseWord?: unknown;
  correctAnswer?: unknown;
}

interface Violation {
  check: string;
  id: string;
  lines: string[];
}

/** Mirrors the private `wordCount` in lib/grading.ts. */
function wordCount(value: string): number {
  const normalised = normalizeForMatch(value);
  return normalised.length === 0 ? 0 : normalised.split(" ").length;
}

/** Mirrors `asAnswerArray` in lib/seed.ts, discarding non-string entries. */
function asAnswerArray(correctAnswer: unknown): string[] {
  if (Array.isArray(correctAnswer)) {
    return (correctAnswer as unknown[]).filter((a): a is string => typeof a === "string");
  }
  return typeof correctAnswer === "string" ? [correctAnswer] : [];
}

/** The exact comparison `lib/seed.ts` uses to resolve a Part 1 answer. */
function seedNormalise(value: string): string {
  return value.trim().toLowerCase();
}

function idOf(item: RawItem): string {
  return typeof item.id === "string" ? item.id : "<unknown id>";
}

// ── Checks ─────────────────────────────────────────────────────────────────

function checkUniqueIds(items: RawItem[], out: Violation[]): number {
  const counts = new Map<string, number>();
  for (const item of items) {
    const id = idOf(item);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    if (count > 1) {
      out.push({
        check: "GLOBAL",
        id,
        lines: [
          `appears ${count} times — ids must be unique`,
          "-> localStorage records are keyed by id, so duplicates collide in the SRS and attempt log.",
        ],
      });
    }
  }
  return counts.size;
}

function checkPart1(items: RawItem[], out: Violation[]): number {
  let checked = 0;
  for (const item of items) {
    if (item.part !== 1) continue;
    checked += 1;
    const id = idOf(item);
    const options = Array.isArray(item.options)
      ? (item.options as unknown[]).filter((o): o is string => typeof o === "string")
      : [];

    if (options.length !== PART1_OPTION_COUNT) {
      out.push({
        check: "PART 1",
        id,
        lines: [`has ${options.length} usable option(s), expected exactly ${PART1_OPTION_COUNT}`],
      });
      continue;
    }

    if (new Set(options.map(seedNormalise)).size !== options.length) {
      out.push({
        check: "PART 1",
        id,
        lines: [`options are not distinct: ${JSON.stringify(options)}`],
      });
    }

    const answers = asAnswerArray(item.correctAnswer);
    if (answers.length === 0) {
      out.push({ check: "PART 1", id, lines: ["has no usable correctAnswer string"] });
      continue;
    }

    const resolved = new Set<string>();
    for (const answer of answers) {
      const hits = options.filter((o) => seedNormalise(o) === seedNormalise(answer));
      if (hits.length === 0) {
        out.push({
          check: "PART 1",
          id,
          lines: [
            `correctAnswer "${answer}" matches none of ${JSON.stringify(options)}`,
            '-> lib/seed.ts would silently fall back to key "A", marking the first option correct.',
          ],
        });
      } else if (hits.length > 1) {
        out.push({
          check: "PART 1",
          id,
          lines: [`correctAnswer "${answer}" matches ${hits.length} options — the key is ambiguous`],
        });
      } else {
        resolved.add(seedNormalise(hits[0]));
      }
    }

    if (resolved.size > 1) {
      out.push({
        check: "PART 1",
        id,
        lines: [
          `correctAnswer resolves to ${resolved.size} different options — a multiple-choice item must have a single key`,
        ],
      });
    }
  }
  return checked;
}

/**
 * Parts 2 and 3 are both single-word gaps, so they share one implementation
 * rather than two that could drift apart.
 */
function checkSingleWordAnswers(items: RawItem[], part: 2 | 3, out: Violation[]): number {
  const check = `PART ${part}`;
  const gapKind = part === 2 ? "open cloze" : "word formation";
  let checked = 0;

  for (const item of items) {
    if (item.part !== part) continue;
    checked += 1;
    const id = idOf(item);
    const answers = asAnswerArray(item.correctAnswer);

    if (answers.length === 0) {
      out.push({ check, id, lines: ["has no usable correctAnswer string"] });
      continue;
    }

    for (const answer of answers) {
      // Hyphens and apostrophes are fine; whitespace means more than one word.
      if (/\s/.test(answer.trim())) {
        out.push({
          check,
          id,
          lines: [
            `answer "${answer}" contains whitespace (${answer.trim().split(/\s+/).length} words)`,
            `-> Part ${part} is a single-word ${gapKind} gap, so a candidate can never produce this.`,
          ],
        });
      }
    }
  }
  return checked;
}

function checkPart4(items: RawItem[], out: Violation[]): number {
  let permutations = 0;
  for (const item of items) {
    if (item.part !== 4) continue;
    const id = idOf(item);
    const answers = asAnswerArray(item.correctAnswer);

    if (answers.length === 0) {
      out.push({ check: "PART 4", id, lines: ["has no usable correctAnswer string"] });
      continue;
    }

    // Cambridge supplies the key word separately and forbids changing it, so
    // it must appear verbatim in every accepted answer. Normalising both sides
    // makes the comparison case-insensitive (answers may start a sentence) and
    // keeps contractions and dialect folding consistent with the marker.
    const rawKey = typeof item.baseWord === "string" ? item.baseWord.trim() : "";
    const key = rawKey === "" ? "" : normalizeForMatch(rawKey);
    if (key === "") {
      out.push({
        check: "PART 4",
        id,
        lines: ["has no baseWord — Part 4 items must supply a key word"],
      });
    }

    for (const answer of answers) {
      // Each permutation is graded on its own, so each must satisfy both rules.
      for (const permutation of expandOptionalWords(answer)) {
        permutations += 1;
        const normalised = normalizeForMatch(permutation);
        const words = wordCount(permutation);

        if (words < MIN_WORDS || words > MAX_WORDS) {
          const lines = [`answer "${answer}"`];
          if (permutation !== answer) lines.push(`permutation "${permutation}"`);
          lines.push(
            `word count ${words} — must be ${MIN_WORDS}–${MAX_WORDS}`,
            "-> lib/grading.ts rejects this, making the item unanswerable."
          );
          out.push({ check: "PART 4", id, lines });
        }

        if (key !== "" && !normalised.split(" ").includes(key)) {
          const lines = [`answer "${answer}"`];
          if (permutation !== answer) lines.push(`permutation "${permutation}"`);
          lines.push(`does not contain the key word "${rawKey}" as a whole word`);
          // Naming the inflection makes the usual cause obvious at a glance.
          const inflected = normalised
            .split(" ")
            .find((token) => token !== key && (token.startsWith(key) || key.startsWith(token)));
          if (inflected) {
            lines.push(`-> "${inflected}" looks like an inflected form of "${rawKey}".`);
          }
          lines.push("-> Cambridge forbids changing the key word, so this answer cannot be credited.");
          out.push({ check: "PART 4", id, lines });
        }
      }
    }
  }
  return permutations;
}

// ── Runner ─────────────────────────────────────────────────────────────────

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const bankPath = resolve(here, "..", "cpe_use_of_english.json");

  let items: RawItem[];
  try {
    items = JSON.parse(readFileSync(bankPath, "utf8")) as RawItem[];
  } catch (error) {
    console.error(`✗ Could not parse cpe_use_of_english.json\n  ${(error as Error).message}`);
    process.exit(1);
  }

  if (!Array.isArray(items) || items.length === 0) {
    console.error("✗ cpe_use_of_english.json did not contain a non-empty array.");
    process.exit(1);
  }

  const violations: Violation[] = [];
  const uniqueIds = checkUniqueIds(items, violations);
  const part1 = checkPart1(items, violations);
  const part2 = checkSingleWordAnswers(items, 2, violations);
  const part3 = checkSingleWordAnswers(items, 3, violations);
  const part4Permutations = checkPart4(items, violations);

  // A part vanishing entirely would otherwise look like a clean pass.
  if (part1 === 0 || part2 === 0 || part3 === 0 || part4Permutations === 0) {
    console.error("✗ A whole part is missing from the bank — refusing to pass.");
    process.exit(1);
  }

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
    console.error("Question bank validation FAILED.");
    process.exit(1);
  }

  console.log("✓ Question bank validation passed");
  console.log(`    ${items.length} items, ${uniqueIds} unique ids`);
  console.log(`    Part 1: ${part1} items — every correctAnswer resolves to exactly one option`);
  console.log(`    Part 2: ${part2} items — every answer is a single word`);
  console.log(`    Part 3: ${part3} items — every answer is a single word`);
  console.log(
    `    Part 4: ${part4Permutations} answer permutations — all ${MIN_WORDS}–${MAX_WORDS} words ` +
      "and containing the key word unchanged"
  );
  process.exit(0);
}

main();
