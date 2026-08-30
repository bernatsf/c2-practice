"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PHRASAL_BANK, PHRASAL_ROOTS } from "@/lib/phrasal";
import { localRepository } from "@/lib/localRepository";
import { dueCount } from "@/lib/srs";

interface DrillStats {
  due: number;
  tracked: number;
  accuracy: number; // 0..1 lifetime
  attempts: number;
}

const EMPTY: DrillStats = { due: 0, tracked: 0, accuracy: 0, attempts: 0 };

/**
 * Dashboard entry point for the standalone phrasal-verb drill.
 *
 * Reads the drill's own storage, never the exam profile — the two progressions
 * are independent by design. Stats load after mount (localStorage is not
 * available during the server render), so the card starts at zero and fills in.
 */
export function PhrasalDrillCard() {
  const [stats, setStats] = useState<DrillStats>(EMPTY);

  useEffect(() => {
    const read = () => {
      const srs = Object.values(localRepository.getPhrasalSrs());
      const profile = localRepository.getPhrasalProfile();
      setStats({
        due: dueCount(srs),
        tracked: srs.length,
        accuracy: profile.totalAttempts === 0 ? 0 : profile.totalCorrect / profile.totalAttempts,
        attempts: profile.totalAttempts,
      });
    };
    read();
    window.addEventListener("storage", read); // cross-tab sync
    return () => window.removeEventListener("storage", read);
  }, []);

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/40 bg-warn/5 p-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted">Phrasal verb drill</div>
        <div className="mt-1 text-sm">
          Rapid-fire production of {PHRASAL_BANK.length} C2 phrasal verbs across{" "}
          {PHRASAL_ROOTS.length} root verbs — meaning in, verb out. Spaced repetition, no timer, no
          exam parts.
        </div>
        <div className="mt-2 text-sm font-mono tabular-nums">
          <span className="text-warn">{stats.due}</span>
          <span className="text-muted"> due</span>
          <span className="mx-2 text-border">·</span>
          <span className="text-muted">{stats.tracked}</span>
          <span className="text-muted"> tracked</span>
          {stats.attempts > 0 && (
            <>
              <span className="mx-2 text-border">·</span>
              <span className="text-muted">{Math.round(stats.accuracy * 100)}%</span>
              <span className="text-muted"> accuracy</span>
            </>
          )}
        </div>
      </div>
      <Link
        href="/phrasal"
        className="rounded-md bg-warn px-5 py-2.5 text-sm font-semibold text-bg hover:brightness-110"
      >
        {stats.due > 0 ? `Drill ${stats.due} due →` : "Start drill →"}
      </Link>
    </section>
  );
}
