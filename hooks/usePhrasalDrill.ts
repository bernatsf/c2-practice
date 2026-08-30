"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PhrasalGrade, PhrasalVerb, RootFilter } from "@/lib/phrasal";
import { gradePhrasal } from "@/lib/phrasal";
import { PhrasalQueue } from "@/lib/phrasalQueue";
import { localRepository } from "@/lib/localRepository";
import { freshSrsItem, reviewSrs } from "@/lib/srs";

export type Phase = "answering" | "revealed";

export interface PhrasalDrillView {
  phase: Phase;
  ready: boolean; // false until the first item is loaded client-side
  current: PhrasalVerb | null;
  index: number; // 1-based item number this session
  streak: number;
  sessionCorrect: number;
  sessionCount: number;
  lastResult: PhrasalGrade | null;
  selectedRoot: RootFilter;
  poolSize: number; // items available under the active root
  dueAll: number; // items due across every root
  dueByRoot: Record<string, number>;
  lifetimeAttempts: number;
  lifetimeCorrect: number;
  bestStreak: number;
}

const NO_DUE = { all: 0, byRoot: {} as Record<string, number> };

/**
 * Session state machine for the phrasal-verb drill.
 *
 * Deliberately parallel to `usePracticeSession` but separate: no ELO, no
 * attempt log, no `Question`. What it does share is the SM-2 scheduler in
 * `lib/srs.ts`, applied to the drill's own store.
 */
export function usePhrasalDrill(initialRoot: RootFilter = "all") {
  const queue = useMemo(() => new PhrasalQueue(initialRoot), [initialRoot]);
  const loadedQueue = useRef<PhrasalQueue | null>(null);

  // Everything below is loaded after mount: the first item depends on
  // Math.random() and localStorage, neither of which matches the server render.
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<PhrasalVerb | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [index, setIndex] = useState(1);
  const [streak, setStreak] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastResult, setLastResult] = useState<PhrasalGrade | null>(null);
  const [selectedRoot, setSelectedRoot] = useState<RootFilter>(initialRoot);
  const [due, setDue] = useState(NO_DUE);
  const [lifetimeAttempts, setLifetimeAttempts] = useState(0);
  const [lifetimeCorrect, setLifetimeCorrect] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    // StrictMode double-invokes this effect in dev; pulling the first item
    // twice would advance the stateful queue and skip an item.
    if (loadedQueue.current === queue) return;
    loadedQueue.current = queue;
    const profile = localRepository.getPhrasalProfile();
    setLifetimeAttempts(profile.totalAttempts);
    setLifetimeCorrect(profile.totalCorrect);
    setBestStreak(profile.bestStreak);
    setStreak(profile.currentStreak);
    setCurrent(queue.next());
    setDue(queue.dueCounts());
    setReady(true);
  }, [queue]);

  const submit = useCallback(
    (raw: string) => {
      if (phase !== "answering" || !current) return;
      const result = gradePhrasal(current, raw);

      const profile = localRepository.getPhrasalProfile();
      const nextStreak = result.correct ? profile.currentStreak + 1 : 0;
      localRepository.savePhrasalProfile({
        totalAttempts: profile.totalAttempts + 1,
        totalCorrect: profile.totalCorrect + (result.correct ? 1 : 0),
        currentStreak: nextStreak,
        bestStreak: Math.max(profile.bestStreak, nextStreak),
        updatedAt: Date.now(),
      });

      // Same SM-2 progression as the exam bank, against the drill's own store.
      const srs = localRepository.getPhrasalSrs();
      const existing = srs[current.id] ?? freshSrsItem(current.id);
      localRepository.savePhrasalSrsItem(reviewSrs(existing, result.correct));

      setDue(queue.dueCounts()); // the answer just changed what is due
      setLastResult(result);
      setStreak(nextStreak);
      setBestStreak((b) => Math.max(b, nextStreak));
      setLifetimeAttempts((a) => a + 1);
      if (result.correct) setLifetimeCorrect((c) => c + 1);
      setSessionCount((c) => c + 1);
      if (result.correct) setSessionCorrect((c) => c + 1);
      setPhase("revealed");
    },
    [current, phase, queue]
  );

  const next = useCallback(() => {
    setCurrent(queue.next());
    setDue(queue.dueCounts());
    setLastResult(null);
    setPhase("answering");
    setIndex((i) => i + 1);
  }, [queue]);

  // Switch the Root Matrix filter and pull a fresh item from the new pool.
  const changeRoot = useCallback(
    (root: RootFilter) => {
      if (root === selectedRoot) return;
      setSelectedRoot(root);
      queue.setRoot(root);
      setCurrent(queue.next());
      setDue(queue.dueCounts());
      setLastResult(null);
      setPhase("answering");
      setIndex((i) => i + 1);
    },
    [queue, selectedRoot]
  );

  const view: PhrasalDrillView = {
    phase,
    ready,
    current,
    index,
    streak,
    sessionCorrect,
    sessionCount,
    lastResult,
    selectedRoot,
    poolSize: queue.size(),
    dueAll: due.all,
    dueByRoot: due.byRoot,
    lifetimeAttempts,
    lifetimeCorrect,
    bestStreak,
  };

  return { ...view, submit, next, changeRoot };
}
