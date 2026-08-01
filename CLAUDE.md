# CLAUDE.md — Project rules for the CPE Use of English trainer

Permanent instructions for working in this repo. Read before touching questions
or engine code.

## 1. Project overview

- **Stack:** Next.js 14 (App Router) · TypeScript (`strict: true`) · Tailwind ·
  deployed on **Vercel**.
- **Question database:** `cpe_use_of_english.json` in the repo root — the single
  source of truth for all items. It is imported directly as a module
  (`resolveJsonModule`) and adapted to the internal `Question` shape in
  `lib/seed.ts`.
- **No backend, no database, no auth.** All user state lives in browser
  `localStorage` via `lib/localRepository.ts`.
- **No test framework and no ESLint config.** Do not run `next lint` — it drops
  into an interactive setup prompt. Verify with the two commands below instead.

For the full system map (routing, ELO, SRS, queue, grading internals) see
`ARCHITECTURE.md`. For the user-facing feature list see `README.md`.

## 2. Verification gate — required

After **any** change to questions or engine code, run both:

```bash
npx tsc --noEmit
```

```bash
npm run build
```

Both must exit 0 before committing. `npm run build` also catches prerender
failures that `tsc` alone will not.

When you change the JSON, additionally confirm it still parses and that IDs stay
unique — a malformed bank fails at runtime, not at compile time.

## 3. The question database

Every record carries the same nine keys, regardless of part:

```json
{
  "id": "p2-126",
  "part": 2,
  "category": "Grammar",
  "questionText": "Rarely ____ a claim been subjected to such scrutiny.",
  "options": null,
  "baseWord": null,
  "targetSentence": null,
  "correctAnswer": "has",
  "explanation": "…why this answer is forced, and the L1 trap it exposes."
}
```

- **IDs** are sequential per part: `p1-`, `p2-`, `p3-`, `p4-`. Never renumber or
  reuse an ID; always continue from the current maximum for that part.
- **Part 1** — `options` is an array of **exactly 4 distinct plain strings**;
  `correctAnswer` is the option **text**, not a letter.
- **Parts 2 & 3** — `questionText` holds the gapped sentence with `____`;
  Part 3 also sets `baseWord` (the root, uppercase).
- **Part 4** — `questionText` is the lead sentence, `targetSentence` the gapped
  second sentence, `baseWord` the key word. Word limits default to **3–8**.
- **`category`** must be one of `False Friend`, `Phrasal Verb`, `Preposition`,
  `Lexical`, `Grammar`. Anything else silently maps to `grammar`.
- **Explanations** name the trap and, where relevant, the Catalan/Spanish
  interference that causes it. This bank is L1-targeted; keep that voice.

### Gotcha: the silent fallback in `lib/seed.ts`

For Part 1, `seed.ts` matches `correctAnswer` against the option **text** and
falls back to key `"A"` when nothing matches. A typo therefore produces no error
— it silently marks the first option correct. **Always verify that every Part 1
`correctAnswer` matches exactly one option** after editing.

Part 1 options are reshuffled at render time (`withShuffledOptions`), so answer
position carries no meaning. Never write distractors that depend on order.

## 4. C2 Part 2 Open Cloze taxonomy — single source of truth

When generating **or auditing** Part 2 questions, use **only** words from this
taxonomy. Every Part 2 gap must strictly target one of these functional
categories.

**Auxiliaries & Inversion**
`be`, `being`, `been`, `is`, `are`, `was`, `were`, `have`, `has`, `had`, `do`,
`does`, `did`

**Modals**
`will`, `would`, `shall`, `should`, `can`, `could`, `may`, `might`, `must`,
`ought`

**Delexicalized / Fixed Verbs**
`make`, `take`, `give`, `put`, `set`, `catch`, `come`, `fall`, `run`, `bear`

**Relatives & Fused Relatives**
`who`, `whom`, `whose`, `which`, `that`, `what`, `where`, `when`, `why`, `how`,
`whoever`, `whatever`, `whichever`, `whereby`, `whereupon`

**Linkers & Concessives**
`but`, `yet`, `although`, `though`, `even`, `whereas`, `while`, `whilst`,
`however`, `despite`, `spite`, `because`, `since`, `as`, `so`, `therefore`,
`thus`, `hence`, `if`, `unless`, `provided`, `providing`, `long`, `whether`,
`otherwise`, `lest`, `albeit`, `granted`, `notwithstanding`, `sooner`,
`scarcely`, `hardly`, `extent`

**Prepositions & Fixed Frames**
`in`, `on`, `at`, `to`, `for`, `with`, `by`, `from`, `of`, `about`, `against`,
`into`, `onto`, `upon`, `within`, `without`, `beyond`, `over`, `under`,
`beneath`, `throughout`, `behest`, `lieu`, `wake`, `virtue`, `sake`, `avail`,
`brink`, `verge`

**Particles**
`up`, `down`, `out`, `off`, `away`, `back`, `forward`

**Quantifiers & Determiners**
`a`, `an`, `the`, `all`, `both`, `some`, `any`, `no`, `none`, `neither`,
`either`, `each`, `every`, `much`, `many`, `more`, `most`, `few`, `fewer`,
`little`, `less`, `least`, `enough`, `several`, `this`, `that`, `these`,
`those`, `such`, `other`, `another`

Inflected forms of the listed verbs count as their lemma — a real cloze gap
needs real tense (`caught` for `catch`, `falls` for `fall`, `borne` for `bear`).

## 5. Question generation constraints

- **Never invent non-Cambridge words for Part 2 gaps.** If a sentence needs a
  word outside the taxonomy, rewrite the sentence — do not extend the list.
- **Part 2 answers are always a single word.** Reject anything containing a
  space.
- **Part 3: always check polarity.** Before settling on a derived form, verify
  whether the sentence logic demands a negative or polarity prefix — `un-`,
  `in-` (and its assimilated `im-`/`il-`/`ir-`), `dis-`, `over-`, `under-`,
  `mis-`. The stem's meaning, not the root word, decides.
- **Store multiple valid C2 synonyms as `string[]` in `correctAnswer`**, e.g.
  `["while", "whilst"]`, `["should", "must"]`, `["brink", "verge"]`,
  `["minimisation", "minimization"]`. Put the primary/targeted answer first.
  Cambridge credits any genuinely correct variant; so must we.
- **The answer must never appear elsewhere in its own sentence** — that hands
  the candidate the answer.
- **Exactly one gap (`____`) per stem**, and no duplicate stems against the
  existing bank.
- Aim for **high-register formal contexts** throughout; this is a C2 paper.

`lib/grading.ts` already handles case, whitespace, contractions and dialect
variants (`towards`/`toward`, `whilst`/`while`), plus optional bracketed words
such as `"did they know (that) the mutation"`. Do not duplicate that logic in
the data — write the clean answer and let the grader normalise.

## 6. Working practice

- Generate and validate bank changes with a **throwaway script** that checks the
  rules above and refuses to write on any failure, rather than hand-editing a
  700-item JSON file.
- Prefer verifying new items through the **real `lib/seed.ts` + `lib/grading.ts`**
  (compile them with `tsc` to a temp dir and exercise them in Node). Validating
  the JSON in isolation misses mapping bugs like the fallback in §3.
- Commit only after the §2 gate passes. Report failures with their output;
  never describe unverified work as verified.
