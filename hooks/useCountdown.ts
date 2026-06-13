"use client";

import { useEffect, useRef, useState } from "react";

// A countdown that resets when `resetKey` changes and pauses when `active` is
// false. Fires `onExpire` exactly once per cycle when it reaches zero.
export function useCountdown({
  durationMs,
  active,
  resetKey,
  onExpire,
}: {
  durationMs: number;
  active: boolean;
  resetKey: string | number;
  onExpire: () => void;
}): number {
  const [remaining, setRemaining] = useState(durationMs);
  const endRef = useRef(0);
  const firedRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Reset the clock for a new cycle.
  useEffect(() => {
    firedRef.current = false;
    endRef.current = Date.now() + durationMs;
    setRemaining(durationMs);
  }, [resetKey, durationMs]);

  // Tick while active.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const rem = Math.max(0, endRef.current - Date.now());
      setRemaining(rem);
      if (rem <= 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        onExpireRef.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [active, resetKey, durationMs]);

  return remaining;
}
