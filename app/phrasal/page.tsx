"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { RootFilter } from "@/lib/phrasal";
import { PHRASAL_ROOTS } from "@/lib/phrasal";
import { PhrasalDrill } from "@/components/phrasal/PhrasalDrill";

/**
 * Standalone phrasal-verb drill. Its own route rather than a `mode` on
 * /practice, because it runs none of the session machinery: no exam parts, no
 * ELO, no unseen/seen 80/20 mixing across the question bank.
 *
 * `?root=GET` opens straight into one root; anything unrecognised falls back to
 * the whole bank. Roots are uppercase in the data, so the param is folded up.
 */
function PhrasalInner() {
  const params = useSearchParams();
  const raw = (params.get("root") ?? "").toUpperCase();
  const root: RootFilter = PHRASAL_ROOTS.includes(raw) ? raw : "all";
  // key forces a fresh queue when the deep-linked root changes.
  return <PhrasalDrill key={root} initialRoot={root} />;
}

export default function PhrasalPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading drill…</div>}>
      <PhrasalInner />
    </Suspense>
  );
}
