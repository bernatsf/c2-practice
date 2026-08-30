"use client";

import Link from "next/link";
import { useState } from "react";
import { useStats } from "@/hooks/useStats";
import { StatCard } from "@/components/dashboard/StatCard";
import { RatingSparkline } from "@/components/dashboard/RatingSparkline";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { SessionConfigurator } from "@/components/dashboard/SessionConfigurator";
import { SimulationHistory } from "@/components/dashboard/SimulationHistory";
import { PhrasalDrillCard } from "@/components/dashboard/PhrasalDrillCard";
import { clearTestHistory } from "@/lib/history";
import { TOTAL_MARKS } from "@/lib/exam";

export default function DashboardPage() {
  const stats = useStats();
  // The history section owns its own state, so a wipe from out here has to
  // remount it to be reflected.
  const [historyKey, setHistoryKey] = useState(0);
  const { profile, rollingAccuracy, allTimeAccuracy, ratingHistory, categories } = stats;
  const { srsDue, srsTracked, srsLapses } = stats;

  return (
    <main className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CPE Use of English</h1>
          <p className="text-sm text-muted">
            Infinite mock-test trainer · Parts 1–4 · L1-targeted (CAT/ES)
          </p>
        </div>
        <button
          onClick={() => {
            if (
              confirm(
                "Reset all progress? This clears your rating, streak, attempt history, simulation history and phrasal-verb drill progress."
              )
            ) {
              stats.reset();
              clearTestHistory();
              setHistoryKey((n) => n + 1);
            }
          }}
          className="text-xs text-muted hover:text-bad"
        >
          Reset progress
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Rating (ELO)"
          value={String(profile.rating)}
          sub={`Peak ${profile.peakRating}`}
          tone="accent"
        />
        <StatCard
          label="Rolling accuracy"
          value={`${Math.round(rollingAccuracy * 100)}%`}
          sub="last 20 answers"
          tone={rollingAccuracy >= 0.7 ? "ok" : "bad"}
        />
        <StatCard
          label="Streak"
          value={String(profile.currentStreak)}
          sub={`Best ${profile.bestStreak}`}
        />
        <StatCard
          label="All-time accuracy"
          value={`${Math.round(allTimeAccuracy * 100)}%`}
          sub={`${profile.totalCorrect}/${profile.totalAttempts} answered`}
        />
      </section>

      <section className="rounded-lg border border-border bg-panel p-4">
        <div className="text-xs uppercase tracking-wider text-muted">Rating trend</div>
        <div className="mt-2">
          <RatingSparkline data={ratingHistory} />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-panel p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">Spaced repetition</div>
          <div className="mt-1 text-sm">
            <span className="font-mono text-lg font-semibold tabular-nums text-warn">{srsDue}</span>
            <span className="text-muted"> due</span>
            <span className="mx-2 text-border">·</span>
            <span className="font-mono tabular-nums text-muted">{srsTracked}</span>
            <span className="text-muted"> tracked</span>
            <span className="mx-2 text-border">·</span>
            <span className="font-mono tabular-nums text-muted">{srsLapses}</span>
            <span className="text-muted"> lapses</span>
          </div>
        </div>
        {srsDue > 0 ? (
          <Link
            href="/practice?mode=srs"
            className="rounded-md bg-warn px-5 py-2.5 text-sm font-semibold text-bg hover:brightness-110"
          >
            Review {srsDue} due item{srsDue === 1 ? "" : "s"} →
          </Link>
        ) : (
          <span className="rounded-md border border-border px-5 py-2.5 text-sm text-muted">
            Nothing due
          </span>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted">Exam simulation</div>
          <div className="mt-1 text-sm">
            Sit a full mock paper under timed conditions — 30 questions across Parts 1–4, marked out
            of {TOTAL_MARKS} with a Cambridge grade.
          </div>
        </div>
        <Link
          href="/exam"
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Start 45-min exam →
        </Link>
      </section>

      <PhrasalDrillCard key={`phrasal-${historyKey}`} />

      <SimulationHistory key={historyKey} />

      <SessionConfigurator />

      <CategoryBreakdown categories={categories} />
    </main>
  );
}
