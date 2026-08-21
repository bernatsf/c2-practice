# Add Part 4 Key Word Transformation Items
Generate strictly verified C2-level Key Word Transformation (Part 4) items.

Input parameters expected:
- $ARGUMENTS: target transformation structure or count.

Pipeline:
1. Scan `cpe_use_of_english.json` to find the highest existing `p4-XXX` ID.
2. Context and Word Count Guardrails:
   - Target answer MUST be strictly between 3 and 8 words (inclusive).
   - Key word must be ALL CAPS in `baseWord` and appear completely unchanged in the answer.
   - ZERO context loss: all non-grammatical modifiers, time/place adverbials, and prepositional phrases from `questionText` must either be in `targetSentence` or fully captured inside `correctAnswer`.
   - Register all 2/2 mark permutations in `correctAnswer` array (e.g., contracted vs uncontracted, valid modal swaps).
3. Set schema fields:
   - `id`: next sequential ID
   - `part`: 4
   - `category`: "Grammar" | "Lexical" | "Phrasal Verb" | "Preposition"
   - `questionText`: full lead sentence
   - `options`: null
   - `baseWord`: ALL CAPS keyword
   - `targetSentence`: sentence containing "____"
   - `correctAnswer`: string | string[]
   - `explanation`: syntactic rationale + common student failure points.
4. Stage, validate, then write — never hand-edit the bank (CLAUDE.md §6):
   - Hold the generated candidates in an in-memory buffer and write them to a
     staging file under `scripts/data/` (e.g. `scripts/data/part4_<slug>.json`).
     Never edit `cpe_use_of_english.json` by hand.
   - Write a throwaway script `scripts/add_part4_<slug>.ts` and run it with
     `npx tsx` — it must be TypeScript because it imports `normalizeForMatch` and
     `expandOptionalWords` from `lib/grading.ts` (as
     `scripts/validate_question_bank.ts` does) instead of reimplementing them, so
     contraction counting and `(optional)` expansion cannot drift from the marker.
     It loads the bank plus the staging file and asserts, per candidate:
     - **Schema:** exactly the nine canonical keys; `part === 4`; `options` is
       `null`; `baseWord` is a non-empty ALL CAPS key word; `targetSentence`
       contains exactly one `____`; `category` is one of the five allowed values.
     - **Word count:** expand every `(optional)` permutation of every accepted
       answer and require each to be 3–8 words inclusive after
       `normalizeForMatch`. Outside that range `lib/grading.ts` rejects the answer
       and the item is unanswerable — the `p4-08` / `p4-10` failure.
     - **Key word:** appears unchanged (case-insensitively, since an answer may
       start a sentence) in every permutation of every accepted answer, and does
       **not** appear in `targetSentence` — that is the `p4-38` trap, where the
       stem hands the candidate the key word.
     - **Context:** every content word, adverbial and prepositional phrase of
       `questionText` is accounted for in `targetSentence` plus the answer; report
       any dropped token for author review rather than passing it silently.
     - **Uniqueness:** `id` absent from the bank and unique within the batch; ids
       continue from the current `p4-` maximum with no reuse or renumbering;
       normalised `questionText` not already in the bank.
   - Collect every failure rather than throwing on the first. If the error list is
     non-empty, print all of them and `process.exit(1)` **without touching**
     `cpe_use_of_english.json`. Append and write only when the list is empty.
   - Support `--dry-run` to print the report and the items that would be appended
     without writing.
5. Run `npm run audit:p4`, `npm run validate:json`, and `npx tsc --noEmit`.
