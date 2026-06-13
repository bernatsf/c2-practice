import type { Part, Question, SessionMode } from "./types";
import { SEED_BANK, withShuffledOptions } from "./seed";
import { localRepository } from "./localRepository";
import { selectNextSrsId } from "./srs";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  private lastId: string | null = null;

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

  private refill() {
    this.buffer = shuffle(this.pool);
  }

  private nextSrs(): Question | null {
    const items = Object.values(localRepository.getSrs());
    const id = selectNextSrsId(items, Date.now(), this.lastId);
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
    return withShuffledOptions(q);
  }

  size() {
    return this.mode === "srs" ? Object.keys(localRepository.getSrs()).length : this.pool.length;
  }
}
