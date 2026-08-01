"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/types";
import type { ExamResult } from "@/lib/exam";
import { buildExamPaper, scoreExam, TOTAL_QUESTIONS } from "@/lib/exam";
import { localRepository } from "@/lib/localRepository";
import { freshSrsItem, reviewSrs } from "@/lib/srs";

export interface ExamSessionView {
  ready: boolean; // false until the paper is built client-side
  paper: Question[];
  answers: Record<string, string>;
  index: number; // 0-based position in the paper
  current: Question | null;
  answeredCount: number;
  result: ExamResult | null; // non-null once submitted
  timedOut: boolean; // the clock ran out rather than the user submitting
}

export function useExamSession() {
  const [ready, setReady] = useState(false);
  const [paper, setPaper] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Build once. The ref guards against React StrictMode double-invoking the
  // effect, which would otherwise throw away the paper the user is looking at
  // and replace it with a different random draw.
  const builtRef = useRef(false);
  useEffect(() => {
    if (builtRef.current) return;
    builtRef.current = true;
    setPaper(buildExamPaper());
    setReady(true);
  }, []);

  // Mirrors of the live state, so a timer expiry firing from a stale closure
  // still submits exactly what is on screen right now.
  const paperRef = useRef(paper);
  paperRef.current = paper;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittedRef = useRef(false);

  const setAnswer = useCallback((questionId: string, value: string) => {
    if (submittedRef.current) return;
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  // Step relative to the current index. Using the functional form of setIndex
  // means next/prev never need `index` in their dependency lists, so both stay
  // referentially stable across renders.
  const step = useCallback((delta: number) => {
    setIndex((prev) => {
      const max = paperRef.current.length - 1;
      if (max < 0) return prev;
      return Math.min(Math.max(prev + delta, 0), max);
    });
  }, []);

  const goTo = useCallback((i: number) => {
    setIndex((prev) => {
      const max = paperRef.current.length - 1;
      if (max < 0) return prev;
      return Math.min(Math.max(i, 0), max);
    });
  }, []);

  const next = useCallback(() => step(1), [step]);
  const prev = useCallback(() => step(-1), [step]);

  // Submitting is idempotent: whichever happens first — the user pressing
  // Finish or the countdown hitting zero — wins, and the other is ignored.
  const submit = useCallback((opts?: { timedOut?: boolean }) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const scored = scoreExam(paperRef.current, answersRef.current);

    // Per the chosen integration: the exam never moves the ELO rating or the
    // streak — a 30-question bulk submit would swamp both — but items that
    // scored zero are pushed into the spaced-repetition queue so exam mistakes
    // resurface during normal practice. Unanswered items count as misses too;
    // not producing an answer is itself a gap worth reviewing.
    for (const item of scored.items) {
      if (item.correct) continue;
      const srs = localRepository.getSrs();
      const existing = srs[item.question.id] ?? freshSrsItem(item.question.id);
      localRepository.saveSrsItem(reviewSrs(existing, false));
    }

    setTimedOut(!!opts?.timedOut);
    setResult(scored);
  }, []);

  const view: ExamSessionView = useMemo(
    () => ({
      ready,
      paper,
      answers,
      index,
      current: paper[index] ?? null,
      answeredCount: paper.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
      result,
      timedOut,
    }),
    [ready, paper, answers, index, result, timedOut]
  );

  return { ...view, total: TOTAL_QUESTIONS, setAnswer, goTo, next, prev, submit };
}
