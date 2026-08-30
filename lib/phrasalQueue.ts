import type { SrsItem } from "./types";
import type { PhrasalVerb, RootFilter } from "./phrasal";
import { PHRASAL_BY_ID, phrasalsForRoot } from "./phrasal";
import { localRepository, seenPhrasalIds } from "./localRepository";
import { partitionBySeen, weightedSample } from "./selection";
import { isDue, selectNextSrsId } from "./srs";

// Endless rapid-fire queue over the phrasal-verb bank.
//
// It is NOT the Parts 1–4 queue and shares no state with it: a different bank,
// a different localStorage key (`cpe.phrasal.srs`) and no ELO. What it does
// share is `lib/srs.ts` — the same SM-2 scheduling, including the 100-day and
// 150-day graduation caps — and `lib/selection.ts` for unseen-first weighting.
//
// Each `next()` prefers the highest-priority DUE item, because a lapsed verb is
// worth more repetitions than a fresh one; when nothing is due it draws new
// material, over-weighted towards items never drilled before.

const REFILL_SIZE = 30;

// After this many due items in a row, force one fresh draw. A failed item
// becomes due immediately (see `reviewSrs`), so without this a learner who
// keeps missing two or three verbs would be locked into re-testing only those
// and would never meet the rest of the bank.
const MAX_CONSECUTIVE_DUE = 3;

export class PhrasalQueue {
  private root: RootFilter;
  private pool: PhrasalVerb[] = [];
  private buffer: PhrasalVerb[] = [];
  private served = new Set<string>(); // ids issued since the last full pass
  private lastId: string | null = null;
  private consecutiveDue = 0;

  constructor(root: RootFilter = "all") {
    this.root = root;
    this.setRoot(root);
  }

  /** Re-aim the queue at one root (or all of them) and start a fresh pass. */
  setRoot(root: RootFilter) {
    this.root = root;
    this.pool = phrasalsForRoot(root);
    if (this.pool.length === 0) this.pool = phrasalsForRoot("all");
    this.served.clear();
    this.buffer = [];
    // Clearing lastId lets the top-priority item of the newly selected root
    // surface immediately rather than being skipped as an immediate repeat.
    this.lastId = null;
    this.consecutiveDue = 0;
    this.refill();
  }

  private refill() {
    let source = this.pool.filter((p) => !this.served.has(p.id));
    if (source.length === 0) {
      this.served.clear();
      source = this.pool;
    }
    const { unseenItems, seenItems } = partitionBySeen(source, seenPhrasalIds());
    this.buffer = weightedSample(unseenItems, seenItems, Math.min(REFILL_SIZE, source.length));
  }

  /** SRS records for items inside the active root filter. */
  private srsCandidates(): SrsItem[] {
    const items = Object.values(localRepository.getPhrasalSrs());
    return items.filter((i) => {
      const pv = PHRASAL_BY_ID.get(i.questionId);
      // Drop records whose verb has left the bank — they cannot be rendered.
      if (!pv) return false;
      return this.root === "all" || pv.root === this.root;
    });
  }

  /** Due count for the active root, and for every root, for the Root Matrix. */
  dueCounts(now = Date.now()): { all: number; byRoot: Record<string, number> } {
    const byRoot: Record<string, number> = {};
    let all = 0;
    for (const item of Object.values(localRepository.getPhrasalSrs())) {
      if (!isDue(item, now)) continue;
      const pv = PHRASAL_BY_ID.get(item.questionId);
      if (!pv) continue;
      all += 1;
      byRoot[pv.root] = (byRoot[pv.root] ?? 0) + 1;
    }
    return { all, byRoot };
  }

  private nextDue(): PhrasalVerb | null {
    if (this.consecutiveDue >= MAX_CONSECUTIVE_DUE) return null;
    const id = selectNextSrsId(this.srsCandidates(), Date.now(), this.lastId);

    // `selectNextSrsId` treats excludeId as a preference, not a rule: it honours
    // it only when something else is also due (`due.length > 1`), otherwise it
    // returns the excluded item anyway. A miss sets dueAt to now, so just after
    // one the failed verb is frequently the ONLY due record — and came back as
    // the very next question, sometimes several times running.
    //
    // Rejecting it here and falling through to a fresh draw fixes that exactly,
    // rather than probabilistically: the verb stays due and resurfaces on a
    // later call, once something else has been in between. The alternative —
    // offsetting a failed item's dueAt — would have to change `reviewSrs`,
    // which the Parts 1–4 review queue shares, and would still break for a
    // learner who takes longer than the offset to answer.
    if (id === null || id === this.lastId) return null;
    return PHRASAL_BY_ID.get(id) ?? null;
  }

  private nextFresh(): PhrasalVerb | null {
    if (this.pool.length === 0) return null;
    if (this.buffer.length === 0) this.refill();
    let pv = this.buffer.pop()!;
    if (pv.id === this.lastId && this.pool.length > 1) {
      this.buffer.unshift(pv);
      if (this.buffer.length === 0) this.refill();
      pv = this.buffer.pop()!;
    }
    return pv;
  }

  next(): PhrasalVerb | null {
    const due = this.nextDue();
    const pv = due ?? this.nextFresh();
    if (!pv) return null;

    this.consecutiveDue = due ? this.consecutiveDue + 1 : 0;
    // A due item is pulled from the SRS map, not from the buffer, so drop it
    // from the buffer too or the same verb would come round twice in one pass.
    if (due) this.buffer = this.buffer.filter((b) => b.id !== pv.id);
    this.served.add(pv.id);
    this.lastId = pv.id;
    return pv;
  }

  /** Items available under the active root filter. */
  size() {
    return this.pool.length;
  }
}
