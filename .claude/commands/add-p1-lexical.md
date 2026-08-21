# Add Part 1 Lexical / False-Friend Items
Generate strictly verified C2-level Multiple Choice (Part 1) items.

Input parameters expected:
- $ARGUMENTS: target lexis, topic, or count (default: 5 items).

Pipeline:
1. Scan `cpe_use_of_english.json` to find the highest existing `p1-XXX` ID.
2. Check existing items to prevent duplicate target lexemes or duplicate sentence stems.
3. Author items adhering to C2 specifications:
   - High-register academic/formal stems testing subtle collocations, idioms, or Spanish/Catalan false friends.
   - 4 plausible options (1 correct key, 3 robust distractors). No invented non-words.
   - 2-sentence explanation: (1) exact collocation/idiomatic mechanic; (2) explicit Spanish/Catalan interference trap.
4. Set schema fields:
   - `id`: next sequential ID
   - `part`: 1
   - `category`: "False Friend" | "Lexical" | "Phrasal Verb" | "Preposition"
   - `questionText`: stem with "____"
   - `options`: array of 4 string choices
   - `baseWord`: null
   - `targetSentence`: null
   - `correctAnswer`: exact string matching one option
   - `explanation`: string
5. Stage, validate, then write — never hand-edit the bank (CLAUDE.md §6):
   - Hold the generated candidates in an in-memory buffer and write them to a
     staging file under `scripts/data/` (e.g. `scripts/data/part1_<slug>.json`).
     Never edit `cpe_use_of_english.json` by hand.
   - Write a throwaway Node script (`scripts/add_part1_<slug>.mjs`, run with
     `node`) that loads the bank plus the staging file and asserts, per candidate:
     - **Schema:** exactly the nine canonical keys; `part === 1`; `options` is an
       array of 4 distinct non-empty strings; `baseWord` and `targetSentence` are
       `null`; `category` is one of the five allowed values.
     - **Key matching:** `correctAnswer` matches exactly one option under
       `value.trim().toLowerCase()` — the same comparison `lib/seed.ts` makes.
       This is the critical check: `seed.ts` falls back to key `"A"` when nothing
       matches, so a typo silently marks option A correct.
     - **Word/stem sanity:** exactly one `____` in `questionText`; the key does
       not appear anywhere else in its own stem.
     - **Uniqueness:** `id` absent from the bank and unique within the batch; ids
       continue from the current `p1-` maximum with no reuse or renumbering;
       normalised stem not already in the bank; target lexeme not already keyed.
   - Collect every failure rather than throwing on the first. If the error list is
     non-empty, print all of them and `process.exit(1)` **without touching**
     `cpe_use_of_english.json`. Append and write only when the list is empty.
   - Support `--dry-run` to print the report and the items that would be appended
     without writing.
6. Run `npm run validate:json` and `npx tsc --noEmit`.
