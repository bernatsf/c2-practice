/**
 * Guards the Part 4 answer-length rule for `cpe_use_of_english.json`.
 *
 * Cambridge Part 4 answers must be 3–8 words. `lib/grading.ts` enforces that
 * range at marking time, so an answer outside it can never be credited however
 * correct it reads — the item silently becomes unanswerable. Two items
 * (p4-08, p4-10) shipped in exactly that state before this check existed.
 *
 * Word counting deliberately reuses `normalizeForMatch` and
 * `expandOptionalWords` from the grading engine rather than reimplementing
 * them, so this script cannot drift from the code that actually marks answers.
 * That matters for two behaviours in particular:
 *
 *   - contractions expand before counting, so "shouldn't have given" is four
 *     words ("should not have given"), exactly as the grader sees it;
 *   - optional bracketed words are expanded first, so BOTH permutations of
 *     "Little did the investors know (that)" are checked independently.
 *
 * Run directly with `npm run validate:json`; also runs as part of `npm test`
 * and as the first step of `npm run build`.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { expandOptionalWords, normalizeForMatch } from "../lib/grading";

// Defaults declared on `Question` in lib/types.ts. `lib/seed.ts` does not map
// per-item overrides out of the JSON, so these apply to every Part 4 item.
const MIN_WORDS = 3;
const MAX_WORDS = 8;

interface RawItem {
  id?: unknown;
  part?: unknown;
  correctAnswer?: unknown;
}

interface Violation {
  id: string;
  answer: string;
  permutation: string;
  words: number;
}

/**
 * Mirrors the private `wordCount` in lib/grading.ts: normalise for matching
 * (which expands contractions and folds dialect variants), then count tokens.
 */
function wordCount(value: string): number {
  const normalised = normalizeForMatch(value);
  return normalised.length === 0 ? 0 : normalised.split(" ").length;
}

function asAnswerArray(correctAnswer: unknown): string[] {
  return Array.isArray(correctAnswer)
    ? (correctAnswer as unknown[]).filter((a): a is string => typeof a === "string")
    : typeof correctAnswer === "string"
      ? [correctAnswer]
      : [];
}

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

  if (!Array.isArray(items)) {
    console.error("✗ cpe_use_of_english.json did not contain a top-level array.");
    process.exit(1);
  }

  const part4 = items.filter((item) => item.part === 4);
  if (part4.length === 0) {
    console.error("✗ No Part 4 items found — the bank looks wrong, refusing to pass.");
    process.exit(1);
  }

  const violations: Violation[] = [];
  const missing: string[] = [];
  let permutationsChecked = 0;

  for (const item of part4) {
    const id = typeof item.id === "string" ? item.id : "<unknown id>";
    const answers = asAnswerArray(item.correctAnswer);

    if (answers.length === 0) {
      missing.push(id);
      continue;
    }

    for (const answer of answers) {
      // Every concrete permutation is graded on its own, so each must fit.
      for (const permutation of expandOptionalWords(answer)) {
        permutationsChecked += 1;
        const words = wordCount(permutation);
        if (words < MIN_WORDS || words > MAX_WORDS) {
          violations.push({ id, answer, permutation, words });
        }
      }
    }
  }

  if (missing.length > 0) {
    console.error(`✗ ${missing.length} Part 4 item(s) have no usable correctAnswer:`);
    for (const id of missing) console.error(`    ${id}`);
  }

  if (violations.length > 0) {
    console.error(
      `\n✗ ${violations.length} Part 4 answer(s) outside the ${MIN_WORDS}–${MAX_WORDS} word range:\n`
    );
    for (const v of violations) {
      console.error(`  ${v.id}`);
      console.error(`    answer     "${v.answer}"`);
      if (v.permutation !== v.answer) {
        console.error(`    permutation "${v.permutation}"`);
      }
      console.error(`    word count  ${v.words}  (must be ${MIN_WORDS}–${MAX_WORDS})`);
      console.error(
        `    -> lib/grading.ts will reject this answer, making the item unanswerable.\n`
      );
    }
  }

  if (violations.length > 0 || missing.length > 0) {
    console.error("Part 4 word-count validation FAILED.");
    process.exit(1);
  }

  console.log(
    `✓ Part 4 word counts OK — ${permutationsChecked} answer permutation(s) across ` +
      `${part4.length} items are all within ${MIN_WORDS}–${MAX_WORDS} words.`
  );
  process.exit(0);
}

main();
