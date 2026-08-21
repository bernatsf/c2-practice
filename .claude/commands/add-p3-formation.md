# Add Part 3 Word Formation Items
Generate strictly verified C2-level Word Formation (Part 3) items.

Input parameters expected:
- $ARGUMENTS: target base root, morphological class, or count.

Pipeline:
1. Scan `cpe_use_of_english.json` to find the highest existing `p3-XXX` ID.
2. Enforce C2-level morphological complexity:
   - Double modifications (e.g., prefix + suffix like *unrealistic*, *destabilisation*).
   - Internal vowel/consonant mutations (e.g., *strong* -> *strengthen*, *deep* -> *depth*).
   - Rare/academic prefixes (*pseudo-*, *ahistorical*, *counterfactual*, *nonconformist*).
   - Accept both UK/US spelling variants where standard (e.g., `["destabilisation", "destabilization"]`).
3. Set schema fields:
   - `id`: next sequential ID
   - `part`: 3
   - `category`: "Lexical"
   - `questionText`: stem with "____"
   - `options`: null
   - `baseWord`: ALL CAPS base lemma (e.g., "STABLE", "SCIENCE")
   - `targetSentence`: null
   - `correctAnswer`: string | string[]
   - `explanation`: morphological breakdown + Spanish false cognate warning.
4. Stage, validate, then write — never hand-edit the bank (CLAUDE.md §6):
   - Hold the generated candidates in an in-memory buffer and write them to a
     staging file under `scripts/data/` (e.g. `scripts/data/part3_<slug>.json`).
     Never edit `cpe_use_of_english.json` by hand.
   - Write a throwaway Node script (`scripts/add_part3_<slug>.mjs`, run with
     `node`) that loads the bank plus the staging file and asserts, per candidate:
     - **Schema:** exactly the nine canonical keys; `part === 3`; `category` is
       `"Lexical"`; `options` and `targetSentence` are `null`; `baseWord` is a
       non-empty ALL CAPS lemma.
     - **Word count:** every entry of `correctAnswer` (string or array) is a
       single word — reject anything containing whitespace; hyphens are fine.
     - **Derivation:** the answer is not the bare `baseWord`, and every accepted
       variant derives from the same root (allowing the declared vowel/consonant
       mutations such as `STRONG` → `strengthen`, `DEEP` → `depth`).
     - **Stem sanity:** exactly one `____` in `questionText`; neither the answer
       nor the bare `baseWord` appears elsewhere in the stem.
     - **Uniqueness:** `id` absent from the bank and unique within the batch; ids
       continue from the current `p3-` maximum with no reuse or renumbering;
       normalised stem not already in the bank; the `baseWord` + answer pair is
       not already covered.
     - **Polarity review:** the script cannot judge sentence meaning, so have it
       print a `baseWord | answer | stem` table for every candidate and require
       an explicit polarity read (`un-`, `in-`/`im-`/`il-`/`ir-`, `dis-`,
       `over-`, `under-`) before the write is accepted.
   - Collect every failure rather than throwing on the first. If the error list is
     non-empty, print all of them and `process.exit(1)` **without touching**
     `cpe_use_of_english.json`. Append and write only when the list is empty.
   - Support `--dry-run` to print the report and the items that would be appended
     without writing.
5. Run `npm run validate:json` and `npx tsc --noEmit`.
