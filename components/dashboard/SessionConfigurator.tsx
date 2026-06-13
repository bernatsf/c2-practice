"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionMode } from "@/lib/types";
import { MODE_LABEL } from "@/components/labels";

const MODES: SessionMode[] = ["part1", "part2", "part3", "part4", "mixed"];

type TimerChoice = "off" | "question" | "session";
const TIMERS: { value: TimerChoice; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "no timer" },
  { value: "question", label: "Per question", hint: "40s · 75s P4" },
  { value: "session", label: "Per session", hint: "5-min sprint" },
];

export function SessionConfigurator() {
  const router = useRouter();
  const [mode, setMode] = useState<SessionMode>("mixed");
  const [timer, setTimer] = useState<TimerChoice>("off");

  const start = () => {
    const params = new URLSearchParams({ mode });
    if (timer !== "off") params.set("timer", timer);
    router.push(`/practice?${params.toString()}`);
  };

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted">Start a session</div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                active
                  ? "border-accent bg-accent/10 text-ink"
                  : "border-border bg-panel2 text-muted hover:border-accent/50 hover:text-ink"
              }`}
            >
              <div className="font-medium">{MODE_LABEL[m].split(" · ")[0]}</div>
              <div className="text-xs text-muted">{MODE_LABEL[m].split(" · ")[1]}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-wider text-muted">Time pressure</div>
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            {TIMERS.map((t) => {
              const active = t.value === timer;
              return (
                <button
                  key={t.value}
                  onClick={() => setTimer(t.value)}
                  title={t.hint}
                  className={`px-3 py-2 text-sm transition ${
                    active ? "bg-accent/15 text-ink" : "bg-panel2 text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={start}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Start →
        </button>
      </div>
    </div>
  );
}
