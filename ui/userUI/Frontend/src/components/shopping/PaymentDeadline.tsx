"use client";
import { useEffect, useRef } from "react";
import type { PaymentDeadline as Deadline } from "@/lib/shopping/types";
import { usePaymentDeadline } from "./usePaymentDeadline";
import styles from "./payment-deadline.module.css";

export function PaymentDeadline({ deadline, orderId, compact = false }: { deadline?: Deadline | null; orderId: string; compact?: boolean }) {
  const { remaining, blocked } = usePaymentDeadline(deadline);
  const previous = useRef<{ key: string; blocked: boolean; status: string } | null>(null);
  useEffect(() => {
    if (!deadline || compact) return;
    const key = `${orderId}:${deadline.expires_at}`;
    const old = previous.current;
    previous.current = { key, blocked, status: deadline.status };
    // Only signal a transition, never every mount of an already expired order.
    if (old?.key === key && ((!old.blocked && blocked) || (old.status !== "expired" && deadline.status === "expired"))) {
      window.dispatchEvent(new CustomEvent("phub:order-changed", { detail: { orderId } }));
    }
  }, [blocked, deadline, orderId, compact]);
  if (!deadline || deadline.status === "closed") return null;
  const date = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
  const seconds = Math.ceil(remaining / 1000);
  const countdown = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const received = deadline.status === "payment_received";
  return <div className={`${styles.notice} ${blocked ? styles.expired : received ? styles.received : ""} ${compact ? styles.compact : ""}`} role="status" aria-label="Hạn thanh toán">
    <strong>{deadline.status === "expired" ? "Đơn đã tự hủy do quá hạn thanh toán" : blocked ? "Đã hết hạn thanh toán" : received ? "Đã ghi nhận khoản thu" : "Thanh toán trong vòng 24 giờ"}</strong>
    {deadline.status === "awaiting_payment" && !blocked && <>
      <span>Hạn thanh toán: <time dateTime={deadline.expires_at}>{date.format(new Date(deadline.expires_at))}</time> (giờ Việt Nam)</span>
      {!compact && <span className={styles.countdown} aria-label="Thời gian còn lại" aria-live="off">Còn {countdown}</span>}
    </>}
    {!compact && <span>{deadline.status === "expired" ? "Hàng giữ đã được giải phóng. Bạn có thể đặt đơn mới." : blocked ? "Hệ thống đang cập nhật việc hủy đơn và giải phóng hàng giữ. Vui lòng đặt đơn mới." : received ? "Đơn không tự hủy theo hạn này. Nếu mới thanh toán một phần, bạn vẫn cần trả số còn lại." : "Nếu chưa có khoản thanh toán thành công khi hết hạn, đơn sẽ tự hủy và giải phóng hàng giữ."}</span>}
  </div>;
}
