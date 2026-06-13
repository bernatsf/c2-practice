"use client";

import { useCallback, useEffect, useState } from "react";
import type { Attempt, CategoryStat, Profile, SrsItem } from "@/lib/types";
import { localRepository } from "@/lib/localRepository";
import { freshProfile } from "@/lib/repository";
import { dueCount } from "@/lib/srs";

const ROLLING_WINDOW = 20;

export interface DerivedStats {
  profile: Profile;
  attempts: Attempt[];
  rollingAccuracy: number; // last N overall (0..1)
  allTimeAccuracy: number; // 0..1
  categories: CategoryStat[]; // sorted, worst accuracy first
  ratingHistory: number[]; // ratingAfter sequence (for sparkline)
  srsDue: number; // items currently due for review
  srsTracked: number; // distinct items with SRS history
  srsLapses: number; // total lapses across all items
}

function derive(
  profile: Profile,
  attempts: Attempt[],
  srs: Record<string, SrsItem>
): DerivedStats {
  const recent = attempts.slice(-ROLLING_WINDOW);
  const rollingAccuracy =
    recent.length === 0 ? 0 : recent.filter((a) => a.isCorrect).length / recent.length;
  const allTimeAccuracy =
    profile.totalAttempts === 0 ? 0 : profile.totalCorrect / profile.totalAttempts;

  const byCat = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const arr = byCat.get(a.category) ?? [];
    arr.push(a);
    byCat.set(a.category, arr);
  }
  const categories: CategoryStat[] = [...byCat.entries()].map(([category, arr]) => {
    const correct = arr.filter((a) => a.isCorrect).length;
    const window = arr.slice(-ROLLING_WINDOW);
    const rollingAcc =
      window.length === 0 ? 0 : window.filter((a) => a.isCorrect).length / window.length;
    const avgResponseMs = Math.round(arr.reduce((s, a) => s + a.responseMs, 0) / arr.length);
    return {
      category: category as CategoryStat["category"],
      attempts: arr.length,
      correct,
      rollingAcc,
      avgResponseMs,
    };
  });
  categories.sort((a, b) => a.rollingAcc - b.rollingAcc);

  const ratingHistory = attempts.slice(-60).map((a) => a.ratingAfter);

  const srsItems = Object.values(srs);
  const srsLapses = srsItems.reduce((sum, i) => sum + i.lapses, 0);

  return {
    profile,
    attempts,
    rollingAccuracy,
    allTimeAccuracy,
    categories,
    ratingHistory,
    srsDue: dueCount(srsItems),
    srsTracked: srsItems.length,
    srsLapses,
  };
}

export function useStats() {
  const [stats, setStats] = useState<DerivedStats>(() => derive(freshProfile(), [], {}));

  const refresh = useCallback(() => {
    setStats(
      derive(
        localRepository.getProfile(),
        localRepository.getAttempts(),
        localRepository.getSrs()
      )
    );
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const reset = useCallback(() => {
    localRepository.reset();
    refresh();
  }, [refresh]);

  return { ...stats, refresh, reset };
}
