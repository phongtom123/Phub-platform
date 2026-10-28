"use client";

import { useEffect, useRef, useState } from "react";
import { useShopping } from "./ShoppingProvider";
import styles from "./AddToCartButton.module.css";

type ButtonPhase = "idle" | "adding" | "added";

function CartIcon({ phase }: { phase: ButtonPhase }) {
  if (phase === "adding") return <span className={styles.spinner} />;

  if (phase === "added") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12.5 4 4L19 6.75" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2l1.6 9.1a2 2 0 0 0 2 1.65h7.8a2 2 0 0 0 1.94-1.5L20 7H6" />
      <path d="M10 19.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM18 19.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM13 8.75v4M11 10.75h4" />
    </svg>
  );
}

export function AddToCartButton({
  product,
  quantity = 1,
  className,
  label = "Thêm vào giỏ",
}: {
  product: { id: string; sku?: string };
  quantity?: number;
  className?: string;
  label?: string;
}) {
  const shop = useShopping();
  const [phase, setPhase] = useState<ButtonPhase>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const handleAdd = async () => {
    if (phase === "adding") return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setPhase("adding");
    const added = await shop.add(product, quantity);
    if (!added) {
      setPhase("idle");
      return;
    }
    setPhase("added");
    resetTimer.current = setTimeout(() => setPhase("idle"), 2200);
  };

  const visibleLabel =
    phase === "adding"
      ? "Đang thêm…"
      : phase === "added"
        ? "Đã thêm vào giỏ"
        : label;

  return (
    <button
      type="button"
      className={[
        styles.button,
        phase === "adding" && styles.loading,
        phase === "added" && styles.added,
        className,
      ].filter(Boolean).join(" ")}
      disabled={shop.cartLoading || shop.authStatus === "loading"}
      onClick={() => void handleAdd()}
      aria-label={`${visibleLabel}${quantity > 1 ? `, số lượng ${quantity}` : ""}`}
      data-state={phase}
    >
      <span className={styles.icon} aria-hidden="true">
        <CartIcon phase={phase} />
      </span>
      <span className={styles.label} aria-live="polite">{visibleLabel}</span>
      {quantity > 1 && phase === "idle" && (
        <span className={styles.quantity} aria-hidden="true">+{quantity}</span>
      )}
    </button>
  );
}
