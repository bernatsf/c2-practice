# CPE Use of English Trainer — System Architecture Summary

## 1. Project identity & stack

- **Name:** `cpe-use-of-english-trainer` (v0.1.0, private). An infinite mock-test trainer for the C2 Proficiency (CPE) *Use of English* paper, Parts 1–4. L1-targeted at Catalan/Spanish speakers (false friends, prepositional mismatches, phrasal verbs).
- **Framework:** Next.js **14.2.5**, **App Router**, React **18.3.1**, TypeScript **5.5.3** (`strict: true`).
- **Styling:** Tailwind CSS 3.4.6 with a custom semantic color palette (`bg`, `ink`, `panel`, `panel2`, `border`, `muted`, `accent`, `ok`, `bad`, `warn`) defined in `tailwind.config.ts` / `app/globals.css`.
- **Path alias:** `@/*` → repo root (`tsconfig.json`).
- **`reactStrictMode: true`** (`next.config.mjs`) — relevant: effects double-fire in dev, and the session hook explicitly guards against this.
- **No backend, no database, no auth, no tests.** All state lives in browser `localStorage`. `resolveJsonModule: true` lets the item bank be imported directly as a module.
- **Scripts:** `dev`, `build` (prod build + typecheck), `start`, `lint`.

## 2. Routing structure (App Router)

```
app/
  layout.tsx           Root layout: <html lang="en">, metadata, centered max-w-5xl container, globals.css
  page.tsx             "/"  Dashboard (client component)
  practice/page.tsx    "/practice"  Session route (client component)
```

- **`/` (Dashboard)** — `"use client"`. Renders stat cards (rating/peak, rolling accuracy, streak, all-time accuracy), a rating sparkline, an SRS status strip (due/tracked/lapses with a "Review N due" link to `/practice?mode=srs`), the `SessionConfigurator`, and `CategoryBreakdown`. Has a "Reset progress" button (`confirm()` → `stats.reset()`).
- **`/practice`** — wraps `PracticeInner` in `<Suspense>` (required because it uses `useSearchParams`). Reads query params:
  - `mode` ∈ `{part1, part2, part3, part4, mixed, srs}` (default/fallback `mixed`).
  - `timer`: `"question"` → `per_question`, `"session"` → `per_session`, else `null`.
  - Renders `<PracticeSession key={`${mode}:${timerMode}`} …>`. **The `key` forces a full remount (fresh queue + session state) whenever mode or timer changes.**
- Navigation is via `next/link` and `useRouter().push()` (from `SessionConfigurator`). There are only these two routes today.

## 3. Domain model (`lib/types.ts`)

Central `Question` interface (single shape for all parts; optional fields used per part):

- Common: `id`, `part` (1|2|3|4), `category` (`Category` union), `difficulty` (number = item ELO), `source` (`"seed" | "llm"`), optional `context`, `explanation`, `l1Trap`, `l1Note`.
- **Part 1 only:** `options: { key: string; text: string }[]` (keys A–F).
- **Part 3 only:** `rootWord`.
- **Part 4 only:** `leadSentence`, `keyWord`, `gapped` (2nd sentence with `____`), `minWords` (default 3), `maxWords` (default 8).
- `answers: string[]` — accepted answers. **Part 1: `["A"]` style option-key array. Parts 2/3: the word. Part 4: the gap-fill phrase(s).** Array allows spelling/grammar variants.

Persistence shapes: `Profile`, `Attempt`, `CategoryStat`, `SrsItem`, plus `GradeResult`. `SessionMode` and `TimerMode` unions. **Note `Category` (10 values) is richer than what `mapCategory` currently emits — only 5 are produced from current data (see §5).**

## 4. The item bank: `cpe_use_of_english.json` → `Question`

**Raw JSON** (`cpe_use_of_english.json`, root): an array of 50 items. Current distribution: **Part 1: 13, Part 2: 12, Part 3: 13, Part 4: 12**; categories: Lexical 27, Preposition 11, False Friend 8, Phrasal Verb 4.

Raw item shape (`RawItem` in `lib/seed.ts`):
```ts
{ id, part:number, category:string, questionText:string,
  options:string[]|null, baseWord:string|null,
  targetSentence:string|null, correctAnswer:string, explanation:string }
```

**Adaptation happens once at module load** in `lib/seed.ts`: `SEED_BANK = (rawData as RawItem[]).map(toQuestion)`. This is the **single source of truth** and the documented seam for merging future LLM-generated items.

`toQuestion(r)` mapping rules:
- `mapCategory`: `"False Friend"→false_friend`, `"Phrasal Verb"→phrasal_verb`, `"Preposition"→preposition`, `"Lexical"→lexical`, **default→`grammar`**.
- `difficultyFor(part, cat)`: no difficulty is authored, so it's derived. Base by category: `false_friend 1750`, `phrasal_verb 1720`, `preposition 1680`, else `1700`; **+40 if part 4**. Items keep this fixed; only the user's rating moves.
- **Part 1:** `options` strings → `{key: OPTION_KEYS[i], text}` where `OPTION_KEYS = ["A","B","C","D","E","F"]`. `questionText`→`context`. `answers` = the key whose text case-insensitively matches `correctAnswer` (fallback `"A"`).
- **Part 4:** `questionText`→`leadSentence`, `targetSentence`→`gapped`, `baseWord`→`keyWord`, `answers=[correctAnswer]`.
- **Parts 2 & 3:** `questionText`→`context`; Part 3 also `baseWord`→`rootWord`; `answers=[correctAnswer]`.

## 5. Option-shuffling helper (`withShuffledOptions`, `lib/seed.ts`)

The authored JSON tends to list the correct option first, so without shuffling the answer is always in slot A. **`withShuffledOptions(q)` is applied at presentation time (in the queue), not at load time**, so each presentation re-randomizes:

```ts
export function withShuffledOptions(q: Question): Question {
  if (q.part !== 1 || !q.options) return q;          // pass-through for Parts 2/3/4
  const correctText = q.options.find(o => o.key === q.answers[0])?.text;
  const options = shuffle(q.options.map(o => o.text)) // Fisher–Yates on TEXTS
    .map((text, i) => ({ key: OPTION_KEYS[i], text }));// reassign A–D by new position
  const correctKey = options.find(o => o.text === correctText)?.key ?? q.answers[0];
  return { ...q, options, answers: [correctKey] };     // answers re-keyed to new slot
}
```

Mechanics that matter:
- It shuffles **option text**, reassigns keys by index, then **recomputes `answers[0]`** to point at whatever slot the correct text landed in. Correctness is preserved because grading keys off the recomputed `answers`.
- It returns a **new object** (`{...q}`); the `SEED_BANK` original is untouched.
- Local `shuffle<T>` (copy + Fisher–Yates) is **duplicated** in both `lib/seed.ts` and `lib/queue.ts` (independent copies).
- Match is by exact text equality after shuffle; safe since texts are unique per question.

## 6. Queue logic (`lib/queue.ts`, class `QuestionQueue`)

Constructed per session via `useMemo(() => new QuestionQueue(mode), [mode])`. Two regimes:

**Part/Mixed modes** (`part1..part4`, `mixed`):
- `partsForMode(mode)` → `[1]/[2]/[3]/[4]`, or `[1,2,3,4]` for mixed/fallback.
- `pool` = `SEED_BANK` filtered to those parts (falls back to full bank if empty).
- `refill()` sets `buffer = shuffle(pool)`. **Endless**: when `buffer` empties it reshuffles.
- `next()`: pops from `buffer`; if the popped item equals `lastId` and `pool.length > 1`, it pushes it back to the front and pops another (**avoids immediate repeat across reshuffle boundaries**). Then `lastId = q.id` and returns **`withShuffledOptions(q)`**.

**SRS / Review mode** (`srs`):
- `pool`/`buffer` unused. `nextSrs()` reads live SRS state from `localRepository.getSrs()`, calls `selectNextSrsId(items, Date.now(), this.lastId)`, looks up the `Question` by id in `byId` (a `Map` of the whole `SEED_BANK`), and returns `withShuffledOptions(q)` or `null` when nothing is due.
- This branch is the documented seam where `/api/generate` (LLM top-up) would plug in.

`size()`: pool length for part/mixed; count of tracked SRS items for srs.

`byId` is built from `SEED_BANK` (full bank) regardless of mode, so SRS lookups always resolve.

## 7. SRS scheduling (`lib/srs.ts`) — SM-2 adapted for binary grading

Constants: `DAY = 86_400_000 ms`, `MIN_EASE 1.3`, `MAX_EASE 3.0`, `START_EASE 2.5`.

- `freshSrsItem(id, now)`: `ease 2.5, reps 0, intervalDays 0, dueAt now, failCount 0, lapses 0, lastResult null`.
- `reviewSrs(item, correct, now)` returns a new record:
  - **Correct:** `reps+1`; `intervalDays` = `1` if reps was 0, `3` if reps was 1, else `round(intervalDays * ease)`; `ease = clamp(ease + 0.1)`; `dueAt = now + intervalDays*DAY`.
  - **Incorrect (lapse):** `reps→0`, `intervalDays→0`, `ease = clamp(ease − 0.2)`, `failCount+1`, `lapses += (reps>0 ? 1 : 0)` (lapse only counts if item was previously learned), `dueAt = now` (**immediately due**).
- `isDue` = `dueAt <= now`; `dueCount` filters.
- **`selectNextSrsId(items, now, excludeId)`** — priority queue: filter to due; sort by (1) most "trouble" = `failCount + lapses` desc, (2) most overdue = lowest `dueAt`, (3) lowest `ease` (hardest). If the top item equals `excludeId` and there's >1 due, return the second. Returns `null` if nothing due.

**Critical behavior:** SRS state is updated on **every** answer in **every** mode (not just review mode) — see §8 — so the review pool fills regardless of how the user practises.

## 8. ELO rating (`lib/elo.ts`)

- `expected(user, item) = 1 / (1 + 10^((item − user)/400))`.
- `kFactor`: `40` while `totalAttempts < 30` (fast early convergence), else `24`.
- `updateRatings(user, item, correct, totalAttempts)` → `{ newUser, newItem, delta }`. User and item both move (`newItem` rises when user fails), but **`newItem` is currently discarded** by callers — item difficulty stays fixed. `STARTING_RATING = 1700` (`lib/repository.ts`).

## 9. Grading (`lib/grading.ts`)

- `normalize(s)`: lowercase, trim, strip `.,;:!?"`, collapse whitespace.
- **Part 1:** answer is an option key; accepts either the key or the option text (normalizes both). Builds `accepted` display string as `"A — text"`.
- **Part 4:** matches normalized user input against any `answers`. On mismatch, returns exam-relevant `message`: if the `keyWord` is absent → "Must use the key word … unchanged."; if word count outside `min–max` → "Answer must be M–N words (you used X)." Word count uses `normalize` then split on spaces.
- **Parts 2 & 3:** `accepted.some(a => normalize(a) === user)`.
- Returns `GradeResult { correct, accepted, message? }`.

## 10. Persistence (`lib/repository.ts` + `lib/localRepository.ts`)

- **`StatsRepository` interface** abstracts storage: `getProfile/saveProfile`, `getAttempts/appendAttempt`, `getCategoryStats/saveCategoryStats`, `getSrs/saveSrsItem`, `reset`. Documented intent: a Supabase impl can satisfy the same interface with zero component/hook changes.
- **`localRepository`** is the only implementation. localStorage keys:
  - `cpe.profile` → `Profile`
  - `cpe.attempts` → `Attempt[]` (**ring buffer capped at `ATTEMPT_CAP = 2000`**; oldest spliced off)
  - `cpe.categoryStats` → `Record<string, CategoryStat>` (**defined & cleared but never written by current code** — category stats are derived on the fly in `useStats`, see §11)
  - `cpe.srs` → `Record<questionId, SrsItem>`
- `read`/`write` are SSR-safe (`typeof window === "undefined"` guard) and swallow JSON/quota errors. `reset()` removes all four keys.
- `freshProfile()` seeds rating/peak at 1700, zeros streaks/counts.

## 11. State flow & hooks

**`usePracticeSession(mode)`** (`hooks/usePracticeSession.ts`) — the session state machine, phases `"answering" → "revealed"`:
- Queue via `useMemo`. `startedAt` ref (per-question stopwatch). State is loaded **after mount only** (a `useEffect` keyed on `queue`) to avoid SSR/hydration mismatch, because the first item depends on `Math.random()` + localStorage. `ready` flips true once loaded.
- **StrictMode guard:** `loadedQueue` ref ensures the first `queue.next()` runs once per queue instance (double-invocation would advance the stateful queue and skip the top item).
- `submit(raw)`: only in `answering` phase. Grades → computes ELO (`updateRatings`) → **persists in order**: `appendAttempt` (full `Attempt` incl. `responseMs = Date.now() − startedAt`, ratings before/after/delta, itemDifficulty) → `saveProfile` (new rating, peak via `max`, streak `+1`/reset, best streak, totals) → SRS update (`existing ?? freshSrsItem`, then `saveSrsItem(reviewSrs(...))`). Then sets `lastResult/lastDelta/currentRating/streak/sessionCount(+1)/sessionCorrect`, phase→`revealed`.
- `next()`: `queue.next()`, clears feedback, phase→`answering`, `index+1`, resets `startedAt`.
- Exposes `SessionView` (`phase, ready, current, index, streak, sessionCorrect, sessionCount, lastResult, lastDelta, currentRating`) + `submit`, `next`.

**`useStats()`** (`hooks/useStats.ts`): derives `DerivedStats` from profile + attempts + srs (NOT from the unused `cpe.categoryStats` key). `ROLLING_WINDOW = 20`. Computes rolling accuracy (last 20), all-time accuracy, per-category stats (grouped from attempts, sorted **worst rollingAcc first**), `ratingHistory` (last 60 `ratingAfter`), `srsDue`/`srsTracked`/`srsLapses`. Re-derives on mount and on the `window` `"storage"` event (cross-tab sync). `reset()` wipes storage + re-derives.

**`useCountdown({durationMs, active, resetKey, onExpire})`** (`hooks/useCountdown.ts`): resets when `resetKey` changes, ticks every 100ms while `active`, fires `onExpire` exactly once per cycle at zero (guarded by `firedRef`). `onExpire` held in a ref so it isn't a tick dependency.

## 12. Presentation layer (components)

- **`PracticeSession.tsx`** (orchestrator): owns `value` (current input) and `ended` (per-session timeout). `valueRef` mirrors `value` so a timer expiry submits whatever's typed. Timer config: `perQuestionMs = part===4 ? 75_000 : 40_000`; `SESSION_MS = 300_000`. `onExpire`: per-session → `setEnded(true)`; per-question → auto-`submit(valueRef.current)`. `timerActive` requires a timer mode, `ready`, a current question, not ended, and (per-question) `answering` phase. Three render branches: **not ready** (placeholder), **ended** (Time's-up summary with re-run/dashboard links), **no current question** (review-mode "Nothing due" empty state), else the live question. Global Enter key advances when revealed. Part 1 selection commits immediately (`handleSelectOption`).
- **`QuestionRenderer.tsx`**: switch on `q.part` → one of four part components.
- **Part components** (`components/practice/parts/`):
  - `Part1MultipleChoice` — option grid; keyboard **1–4** select; on reveal, colors correct (`ok`) / selected-wrong (`bad`) / dims rest.
  - `Part2OpenCloze`, `Part3WordFormation` (shows `rootWord`), `Part4KeyTransformation` (shows `leadSentence`, `keyWord` chip, gapped sentence, min–max rule text) — all use shared `TextAnswer`.
  - `TextAnswer` — single-line input; auto-focus on mount/when re-enabled; Enter submits if non-empty & enabled; autocomplete/spellcheck off.
  - `GapText` — splits text on `"____"` and renders a styled underline blank.
- **`FeedbackBar.tsx`** — binary CORRECT/INCORRECT, ELO delta, "Next ↵"; on failure shows accepted answer(s) (joined `/`), optional `message` (warn), `explanation`, and `l1Note`.
- **`SessionHUD.tsx`** — back link, mode label, part+category chip, item index, session correct/count/accuracy, streak 🔥, rating.
- **`SessionTimer.tsx`** — progress bar from `remainingMs/durationMs`.
- **`labels.ts`** — `CATEGORY_LABEL` (all 10 categories) and `MODE_LABEL` (e.g. `"Part 1 · Multiple-choice cloze"`, `"Review · Failed items"`); the `" · "` split is parsed by `SessionConfigurator`.
- **Dashboard** (`components/dashboard/`): `StatCard`, `RatingSparkline`, `CategoryBreakdown`, `SessionConfigurator` (mode buttons `part1..part4, mixed` + timer toggle off/question/session → `router.push("/practice?mode=…&timer=…")`; **note: `srs` is intentionally not offered here — only reachable via the dashboard's "Review N due" link**).

## 13. Documented extension seams (not yet implemented)

1. **Infinite LLM generation:** add `app/api/generate/route.ts`; have `QuestionQueue.refill()` top up `pool` from it when low (part/mixed), and/or feed the SRS branch. New items must match the `Question` shape and set `source: "llm"`. `seed.ts` is also a stated merge point.
2. **Cloud sync:** implement `StatsRepository` against Supabase; swap `localRepository`. No component/hook changes required by design.

## 14. Known gaps / quirks for a successor

- `cpe.categoryStats` key + `saveCategoryStats`/`getCategoryStats` exist but are **never written**; category metrics are derived live in `useStats`. Dead-ish storage path.
- `updateRatings` computes `newItem` but callers discard it — item difficulties are static.
- `shuffle` is duplicated in `seed.ts` and `queue.ts`.
- `Category` union has 10 members; `mapCategory` only ever emits 5 (`false_friend, phrasal_verb, preposition, lexical, grammar`) from current data. `l1Trap`/`l1Note` are typed and rendered but **not populated** by `toQuestion` (no source fields in the JSON), so the L1-note feedback line never shows with current data.
- Seed bank is deliberately small (50 items) pending core-mechanic finalization.
- All randomness/persistence is client-only; pages are `"use client"`; `/practice` needs the `Suspense` boundary for `useSearchParams`.
