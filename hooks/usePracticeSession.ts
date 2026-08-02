"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GradeResult,
  PartDueCounts,
  PartFilter,
  Question,
  SessionMode,
} from "@/lib/types";
import { QuestionQueue } from "@/lib/queue";
import { grade } from "@/lib/grading";
import { updateRatings } from "@/lib/elo";
import { localRepository } from "@/lib/localRepository";
import { freshSrsItem, reviewSrs } from "@/lib/srs";

export type Phase = "answering" | "revealed";

const NO_DUE: PartDueCounts = { all: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

export interface SessionView {
  phase: Phase;
  ready: boolean; // false until the first item is loaded client-side
  current: Question | null; // null in review mode when nothing is due
  index: number; // 1-based item number this session
  streak: number;
  sessionCorrect: number;
  sessionCount: number;
  lastResult: GradeResult | null;
  lastDelta: number | null; // rating change of last answer
  currentRating: number;
  selectedPart: PartFilter; // review-mode part filter ("all" outside review mode)
  srsDue: PartDueCounts; // due counts per part, for the review filter UI
}

export function usePracticeSession(mode: SessionMode) {
  const queue = useMemo(() => new QuestionQueue(mode), [mode]);
  const startedAt = useRef<number>(Date.now());
  const loadedQueue = useRef<QuestionQueue | null>(null);

  // State is loaded after mount (client-only) to avoid SSR/hydration mismatch:
  // the first item depends on Math.random() and localStorage, neither of which
  // matches the server render.
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [index, setIndex] = useState(1);
  const [streak, setStreak] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [lastResult, setLastResult] = useState<GradeResult | null>(null);
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [currentRating, setCurrentRating] = useState<number>(0);
  const [selectedPart, setSelectedPart] = useState<PartFilter>("all");
  // Starts empty so the server render and the first client render agree; the
  // real counts are read from localStorage in the mount effect below.
  const [srsDue, setSrsDue] = useState<PartDueCounts>(NO_DUE);

  useEffect(() => {
    // Guard against React StrictMode double-invoking this effect: pulling the
    // first item twice would advance the (stateful) queue and skip the
    // top-priority item. Load once per queue instance.
    if (loadedQueue.current === queue) return;
    loadedQueue.current = queue;
    setCurrentRating(localRepository.getProfile().rating);
    setCurrent(queue.next());
    setSrsDue(queue.srsDueCounts());
    setReady(true);
  }, [queue]);

  const submit = useCallback(
    (raw: string) => {
      if (phase !== "answering" || !current) return;
      const result = grade(current, raw);
      const responseMs = Date.now() - startedAt.current;

      const profile = localRepository.getProfile();
      const { newUser, delta } = updateRatings(
        profile.rating,
        current.difficulty,
        result.correct,
        profile.totalAttempts
      );

      // Persist attempt
      localRepository.appendAttempt({
        questionId: current.id,
        part: current.part,
        category: current.category,
        userAnswer: raw,
        isCorrect: result.correct,
        responseMs,
        ratingBefore: profile.rating,
        ratingAfter: newUser,
        ratingDelta: delta,
        itemDifficulty: current.difficulty,
        createdAt: Date.now(),
      });

      // Persist profile
      const nextStreak = result.correct ? profile.currentStreak + 1 : 0;
      localRepository.saveProfile({
        rating: newUser,
        peakRating: Math.max(profile.peakRating, newUser),
        currentStreak: nextStreak,
        bestStreak: Math.max(profile.bestStreak, nextStreak),
        totalAttempts: profile.totalAttempts + 1,
        totalCorrect: profile.totalCorrect + (result.correct ? 1 : 0),
        updatedAt: Date.now(),
      });

      // Update spaced-repetition state for this item (tracked in every mode,
      // so the review pool fills up regardless of how you practise).
      const srs = localRepository.getSrs();
      const existing = srs[current.id] ?? freshSrsItem(current.id);
      localRepository.saveSrsItem(reviewSrs(existing, result.correct));
      // The answer just changed what is due, so the filter counts are stale.
      setSrsDue(queue.srsDueCounts());

      setLastResult(result);
      setLastDelta(delta);
      setCurrentRating(newUser);
      setStreak(nextStreak);
      setSessionCount((c) => c + 1);
      if (result.correct) setSessionCorrect((c) => c + 1);
      setPhase("revealed");
    },
    [current, phase, queue]
  );

  const next = useCallback(() => {
    setCurrent(queue.next());
    setSrsDue(queue.srsDueCounts());
    setLastResult(null);
    setLastDelta(null);
    setPhase("answering");
    setIndex((i) => i + 1);
    startedAt.current = Date.now();
  }, [queue]);

  // Switch the review filter and pull a fresh item from the newly filtered
  // queue. `index` advances as well, which is what resets the per-question
  // countdown (its resetKey is derived from the index).
  const changePart = useCallback(
    (part: PartFilter) => {
      if (part === selectedPart) return;
      setSelectedPart(part);
      queue.setSrsPartFilter(part);
      setCurrent(queue.next());
      setSrsDue(queue.srsDueCounts());
      setLastResult(null);
      setLastDelta(null);
      setPhase("answering");
      setIndex((i) => i + 1);
      startedAt.current = Date.now();
    },
    [queue, selectedPart]
  );

  const view: SessionView = {
    phase,
    ready,
    current,
    index,
    streak,
    sessionCorrect,
    sessionCount,
    lastResult,
    lastDelta,
    currentRating,
    selectedPart,
    srsDue,
  };

  return { ...view, submit, next, changePart };
}
