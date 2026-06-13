"use client";

import Link from "next/link";
import { useStats } from "@/hooks/useStats";
import { StatCard } from "@/components/dashboard/StatCard";
import { RatingSparkline } from "@/components/dashboard/RatingSparkline";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { SessionConfigurator } from "@/components/dashboard/SessionConfigurator";

export default function DashboardPage() {
  const stats = useStats();
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
            if (confirm("Reset all progress? This clears your rating, streak and history.")) {
              stats.reset();
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

      <SessionConfigurator />

      <CategoryBreakdown categories={categories} />
    </main>
  );
}
