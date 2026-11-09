"use client";

import { useEffect, useRef, useState } from "react";
import { cancelOrder } from "@/lib/shopping/client";
import type { OrderDetail } from "@/lib/shopping/types";
import styles from "./shopping.module.css";

export function CancelOrderButton({ orderId, status, disabled = false, onCancelled }: {
  orderId: string; status: string; disabled?: boolean; onCancelled: (order: OrderDetail) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (cancelled || !["MOI", "XAC_NHAN", "DANG_CHUAN_BI"].includes(status)) return null;

  async function cancel() {
    if (pending.current || disabled) return;
    if (!window.confirm("Bạn muốn hủy đơn hàng này? Hệ thống sẽ giải phóng hàng đang giữ. Đơn đã thu tiền thực tế cần nhân viên xử lý hoàn tiền trước.")) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const saved = await cancelOrder(orderId);
      if (saved.id !== orderId || saved.status !== "HUY") throw new Error("Chưa xác nhận được đơn đã hủy. Hãy cập nhật đơn để kiểm tra.");
      if (!mounted.current) return;
      setCancelled(true);
      onCancelled(saved);
      window.dispatchEvent(new CustomEvent("phub:order-changed", { detail: { orderId } }));
      window.dispatchEvent(new Event("phub:invoice-changed"));
    } catch (reason) {
      if (mounted.current) setError(reason instanceof Error ? reason.message : "Không thể hủy đơn hàng. Vui lòng thử lại.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return <div className={styles.cancelAction}>
    <button type="button" className={styles.cancelButton} disabled={disabled || busy} onClick={() => void cancel()}>
      {busy ? "Đang hủy đơn…" : "Hủy đơn hàng"}
    </button>
    {error && <p className={styles.cancelError} role="alert">{error}</p>}
  </div>;
}
