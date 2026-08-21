# Add Part 2 Open Cloze Items
Generate strictly verified C2-level Open Cloze (Part 2) items.

Input parameters expected:
- $ARGUMENTS: target grammatical structure, discourse marker, or count.

Pipeline:
1. Scan `cpe_use_of_english.json` to find the highest existing `p2-XXX` ID.
2. Ensure targets strictly test grammatical/functional words (e.g., inversions, cleft linkers, archaic concessives like *albeit/lest/notwithstanding*, fused relatives like *whereby/whereupon/whoever*, fixed prepositions).
3. Author items:
   - Exactly ONE single word required for the gap ("____").
   - Register all valid C2 synonyms in `correctAnswer` as an array (e.g., `["while", "whilst"]`, `["lieu", "place"]`), or a single string if strictly unique.
   - Explanation highlighting why alternative surface forms fail and identifying L1 transfer traps.
4. Set schema fields:
   - `id`: next sequential ID
   - `part`: 2
   - `category`: "Grammar" | "Preposition" | "Lexical" | "Phrasal Verb"
   - `questionText`: stem with "____"
   - `options`: null
   - `baseWord`: null
   - `targetSentence`: null
   - `correctAnswer`: string | string[]
   - `explanation`: string
5. Stage, validate, then write — never hand-edit the bank (CLAUDE.md §6):
   - Hold the generated candidates in an in-memory buffer and write them to a
     staging file under `scripts/data/` (e.g. `scripts/data/part2_<slug>.json`).
     Never edit `cpe_use_of_english.json` by hand.
   - Write a throwaway Node script (`scripts/add_part2_<slug>.mjs`, run with
     `node`) that loads the bank plus the staging file and asserts, per candidate:
     - **Schema:** exactly the nine canonical keys; `part === 2`; `options`,
       `baseWord` and `targetSentence` are `null`; `category` is one of the five
       allowed values.
     - **Word count:** every entry of `correctAnswer` (string or array) is a
       single word — reject anything containing whitespace; hyphens are fine.
     - **Taxonomy:** every answer resolves to a lemma listed in the CLAUDE.md §4
       open-cloze taxonomy, counting inflected forms as their lemma (`caught` →
       `catch`, `borne` → `bear`). A word outside the list fails the run; rewrite
       the sentence rather than extending the taxonomy.
     - **Stem sanity:** exactly one `____` in `questionText`; no accepted answer
       appears elsewhere in its own sentence.
     - **Uniqueness:** `id` absent from the bank and unique within the batch; ids
       continue from the current `p2-` maximum with no reuse or renumbering;
       normalised stem not already in the bank.
   - Collect every failure rather than throwing on the first. If the error list is
     non-empty, print all of them and `process.exit(1)` **without touching**
     `cpe_use_of_english.json`. Append and write only when the list is empty.
   - Support `--dry-run` to print the report and the items that would be appended
     without writing.
6. Run `npm run validate:json` and `npx tsc --noEmit`.
