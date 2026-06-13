# CPE Use of English — Infinite Trainer

A data-driven, gamified trainer for the **C2 Proficiency (CPE) Use of English** paper
(Parts 1–4). Seed-bank-driven, localStorage-first, no backend required.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + type check
```

> Requires Node.js LTS. The first run creates your profile in the browser's
> `localStorage` — there is no account or server.

## Features (v1 — core)

- **All four parts**, exam-accurate:
  - Part 1 — Multiple-choice cloze (idioms, collocations, fixed phrases)
  - Part 2 — Open cloze (prepositions, linking words, grammar)
  - Part 3 — Word formation (prefixes/suffixes)
  - Part 4 — Key word transformations (with the 3–8 word + unchanged-key-word rules)
- **Menu selector**: practice any single part or **Mixed** mode.
- **ELO rating**: user and items both carry a rating; every answer moves it
  (`lib/elo.ts`). Profile starts at **1700** (strong C1 baseline).
- **Dashboard metrics**: rating + peak, rolling accuracy (last 20), streaks,
  all-time accuracy, rating sparkline, per-category breakdown (weakest first).
- **L1-targeted seed bank** (`lib/seed.ts`): false friends (*actually, eventually,
  sensible/sensitive*), prepositional mismatches (*depend **on**, consist **of**,
  insist **on**, married **to***), and phrasal verbs — the traps that catch
  Catalan/Spanish speakers at C2.
- **Instant binary feedback**: Correct / Incorrect, correct answer on failure,
  the relevant L1 note, and Enter → next. No praise, no pop-ups.
- Fully **keyboard-driven**: 1–4 to pick options, Enter to submit/advance.
- **Spaced repetition** (`lib/srs.ts`): every answer updates an SM-2-style schedule.
  Failed/overdue items are prioritised in **Review** mode (weakest first); correct
  answers graduate to longer intervals. Dashboard shows due / tracked / lapses.
- **Time-pressure timer** (optional): **per-question** countdown (40s, 75s for
  Part 4) that auto-submits on expiry, or a **per-session** 5-minute sprint with a
  "Time's up" summary. Per-question pauses during feedback; per-session runs
  continuously.

## Architecture

```
app/
  page.tsx              Dashboard (metrics + menu selector)
  practice/page.tsx     Session route (?mode=part1|part2|part3|part4|mixed)
lib/
  types.ts              Domain + persistence types
  seed.ts               The item bank (L1-targeted)
  elo.ts                Rating math
  grading.ts            Per-part answer normalization & validation
  queue.ts              Endless shuffled queue (LLM generation plugs in here)
  repository.ts         StatsRepository interface (+ STARTING_RATING)
  localRepository.ts    localStorage implementation (swap for Supabase later)
hooks/
  usePracticeSession.ts Session state machine (answering → revealed)
  useStats.ts           Derives dashboard metrics from the attempt log
  useCountdown.ts       Reusable pausable/resettable countdown (timer)
components/
  dashboard/ practice/  UI
```

### Swapping storage / adding generation later
- **Cloud sync**: implement `StatsRepository` against Supabase; no component changes.
- **Infinite generation**: add `app/api/generate/route.ts` (LLM) and have
  `QuestionQueue.refill()` top up from it when the pool runs low. Items must match
  the `Question` shape in `lib/types.ts`.

## Not yet implemented
- **Infinite LLM generation** — extension point ready at `QuestionQueue.refill()`
  (see above); currently seed-bank only, by design.
- **Seed-bank expansion** — kept small while finalising core mechanics.
