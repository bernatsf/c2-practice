"use client";

import { useState } from "react";
import { ExamSession } from "@/components/exam/ExamSession";

export default function ExamPage() {
  // Bumping the attempt counter remounts the session, which draws a brand-new
  // paper and resets the clock — the whole exam state lives inside that tree.
  const [attempt, setAttempt] = useState(0);
  return <ExamSession key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}
