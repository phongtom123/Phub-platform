"use client";
import Link from "next/link";
import { useState } from "react";
import { validateOrders } from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import { useCustomerResource } from "./useCustomerResource";
import styles from "./shopping.module.css";
export const orderStatus: Record<string, string> = {
  MOI: "Mới đặt",
  XAC_NHAN: "Đã xác nhận",
  DANG_CHUAN_BI: "Đang chuẩn bị",
  DA_XUAT_KHO: "Đã xuất kho",
  HOAN_THANH: "Hoàn thành",
  HUY: "Đã hủy",
  UNKNOWN: "Chưa xác định",
};
export function OrderHistory() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useCustomerResource(
    `orders?page=${page}&page_size=10`,
    validateOrders,
  );
  return (
    <section className={styles.panel}>
      <div className={styles.inline}>
        <h2>Đơn hàng của tôi</h2>
        <button type="button" disabled={loading} onClick={reload}>
          Cập nhật
        </button>
      </div>
      {loading && <p role="status">Đang tải đơn hàng…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <ul className={styles.orders}>
            {data.items.map((order) => (
              <li key={order.id}>
                <Link href={`/main/orders/${encodeURIComponent(order.id)}`}>
                  Đơn {order.id}
                </Link>
                <p>
                  {orderStatus[order.status] || orderStatus.UNKNOWN} ·{" "}
                  {order.created_at.replace("T", " ")}
                </p>
                <strong>{money(order.total, order.currency)}</strong>{" "}
                <Link
                  href={`/main/orders/${encodeURIComponent(order.id)}#payments`}
                >
                  Xem thanh toán
                </Link>
              </li>
            ))}
          </ul>
          {!data.items.length && <p>Chưa có đơn hàng trong trang này.</p>}
          <div className={styles.pager}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang trước
            </button>
            <span>
              Trang {page} / {Math.max(1, data.pagination.total_pages)}
            </span>
            <button
              type="button"
              disabled={page >= data.pagination.total_pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}
