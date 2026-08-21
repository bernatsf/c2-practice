import type { Part, PartDueCounts, PartFilter, Question, SessionMode, SrsItem } from "./types";
import { SEED_BANK, withShuffledOptions } from "./seed";
import { localRepository, seenQuestionIds } from "./localRepository";
import { partitionBySeen, weightedSample } from "./selection";
import { isDue, selectNextSrsId } from "./srs";

// How many items each refill draws. The unseen quota is applied per refill, so
// this has to be a SESSION-SIZED chunk rather than the whole pool: weighting a
// batch the size of the bank is a no-op, because 75% of 1800 items exceeds the
// unseen bucket and the sampler just falls back to taking everything.
const REFILL_SIZE = 30;

function partsForMode(mode: SessionMode): Part[] {
  switch (mode) {
    case "part1":
      return [1];
    case "part2":
      return [2];
    case "part3":
      return [3];
    case "part4":
      return [4];
    default:
      return [1, 2, 3, 4]; // mixed / srs fallback
  }
}

// Endless queue. For part/mixed modes it reshuffles the filtered bank each pass,
// avoiding an immediate repeat. For "srs" mode it selects the highest-priority
// due item from live SRS state on every call (returns null when nothing is due).
// The SRS branch is also the seam where /api/generate plugs in later.
export class QuestionQueue {
  private mode: SessionMode;
  private byId: Map<string, Question>;
  private pool: Question[] = [];
  private buffer: Question[] = [];
  private served = new Set<string>(); // ids issued since the last full pass
  private lastId: string | null = null;
  private srsPart: PartFilter = "all";

  constructor(mode: SessionMode) {
    this.mode = mode;
    this.byId = new Map(SEED_BANK.map((q) => [q.id, q]));
    if (mode !== "srs") {
      const parts = partsForMode(mode);
      this.pool = SEED_BANK.filter((q) => parts.includes(q.part));
      if (this.pool.length === 0) this.pool = [...SEED_BANK];
      this.refill();
    }
  }

  // Draw the next chunk, over-weighted towards items with no attempt history.
  //
  // `served` preserves the property the previous full-pool shuffle gave for
  // free: nothing repeats until the whole pool has been worked through. Without
  // it, weighting each chunk independently would let a small unseen bucket
  // resurface every refill while most of the bank went untouched.
  //
  // The seen set is re-read on every refill rather than cached, so items
  // answered earlier in this session correctly stop counting as unseen.
  private refill() {
    let source = this.pool.filter((q) => !this.served.has(q.id));
    if (source.length === 0) {
      this.served.clear();
      source = this.pool;
    }
    const { unseenItems, seenItems } = partitionBySeen(source, seenQuestionIds());
    this.buffer = weightedSample(unseenItems, seenItems, Math.min(REFILL_SIZE, source.length));
  }

  // Restrict review mode to a single exam part (or "all"). `SrsItem` stores only
  // a questionId, so the part is resolved through `byId` rather than read off the
  // record. Clearing `lastId` lets the top-priority item of the newly selected
  // part surface immediately instead of being skipped as an immediate repeat.
  setSrsPartFilter(part: PartFilter) {
    this.srsPart = part;
    this.lastId = null;
  }

  // SRS records eligible under the active filter. Records whose question is no
  // longer in the bank are dropped — `nextSrs` could not render them anyway.
  private srsCandidates(): SrsItem[] {
    const items = Object.values(localRepository.getSrs());
    if (this.srsPart === "all") return items;
    return items.filter((i) => this.byId.get(i.questionId)?.part === this.srsPart);
  }

  // Due counts per part (and overall), for the review filter UI. Always counts
  // across every part, independent of the active filter, so the UI can show what
  // is waiting behind the other pills.
  srsDueCounts(now = Date.now()): PartDueCounts {
    const counts: PartDueCounts = { all: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const item of Object.values(localRepository.getSrs())) {
      if (!isDue(item, now)) continue;
      const q = this.byId.get(item.questionId);
      if (!q) continue;
      counts.all += 1;
      counts[q.part] += 1;
    }
    return counts;
  }

  private nextSrs(): Question | null {
    const id = selectNextSrsId(this.srsCandidates(), Date.now(), this.lastId);
    if (!id) {
      this.lastId = null;
      return null;
    }
    this.lastId = id;
    const q = this.byId.get(id);
    return q ? withShuffledOptions(q) : null;
  }

  next(): Question | null {
    if (this.mode === "srs") return this.nextSrs();

    if (this.buffer.length === 0) this.refill();
    let q = this.buffer.pop()!;
    if (q.id === this.lastId && this.pool.length > 1) {
      this.buffer.unshift(q);
      if (this.buffer.length === 0) this.refill();
      q = this.buffer.pop()!;
    }
    this.lastId = q.id;
    this.served.add(q.id);
    return withShuffledOptions(q);
  }

  size() {
    return this.mode === "srs" ? Object.keys(localRepository.getSrs()).length : this.pool.length;
  }
}
