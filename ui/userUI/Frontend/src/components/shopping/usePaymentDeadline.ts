"use client";
import { useEffect, useState } from "react";
import type { PaymentDeadline } from "@/lib/shopping/types";
import { deadlineBlocksPayment, deadlineRemaining } from "@/lib/shopping/payment-deadline";

/** Advance the server's clock monotonically; the shopper's wall clock is irrelevant. */
export function usePaymentDeadline(deadline?: PaymentDeadline | null) {
  const identity = JSON.stringify(deadline ?? null);
  const [clock, setClock] = useState({ identity: "", elapsed: 0 });
  useEffect(() => {
    if (!deadline || deadline.status !== "awaiting_payment") return;
    const started = performance.now();
    const tick = () => {
      if (document.visibilityState !== "hidden") setClock({ identity, elapsed: performance.now() - started });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [identity, deadline]);
  const remaining = deadline ? deadlineRemaining(deadline, clock.identity === identity ? clock.elapsed : 0) : 0;
  return { remaining, blocked: deadlineBlocksPayment(deadline, remaining) };
}
