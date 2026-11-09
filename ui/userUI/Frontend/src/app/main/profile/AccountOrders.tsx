"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/common/Button";
import { PaymentDeadline } from "@/components/shopping/PaymentDeadline";
import { CancelOrderButton } from "@/components/shopping/CancelOrderButton";
import { formatDate, formatMoney, orderStatus, parseOrders } from "@/lib/account/client";
import { useAccountResource } from "@/lib/account/useAccountResource";
import { AccountIcon } from "./AccountIcon";
import { DataState, Pager, Panel } from "./AccountPanels";
import styles from "./profile.module.css";

export function AccountOrders({ recent = false, onViewAll }: { recent?: boolean; onViewAll?: () => void }) {
  const [page, setPage] = useState(1);
  const orders = useAccountResource(`customer/orders?page=${recent ? 1 : page}&page_size=${recent ? 5 : 10}`, parseOrders, 60000);
  const sorted = useMemo(() => [...(orders.data?.items ?? [])].sort((a, b) =>
    Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id)), [orders.data]);
  useEffect(() => {
    const changed = () => orders.reload();
    window.addEventListener("phub:order-changed", changed);
    return () => window.removeEventListener("phub:order-changed", changed);
  }, [orders.reload]);
  return <Panel title={recent ? "Đơn hàng gần đây" : "Đơn hàng của tôi"} action={<Button className={styles.secondaryButton} variant="outline" disabled={orders.loading} onClick={orders.reload}>Làm mới đơn hàng</Button>}>
    <DataState {...orders} />
    {orders.data && <>
      <p className={styles.orderCount}>{recent ? `${Math.min(5, sorted.length)} đơn gần nhất` : `${orders.data.pagination.total} đơn hàng`} <span>Mới nhất trước · Xem hóa đơn trong chi tiết đơn.</span></p>
      {sorted.length ? <div className={styles.orderList}>{sorted.slice(0, recent ? 5 : sorted.length).map(order => <article className={styles.orderCard} key={order.id} aria-label={`Đơn ${order.id}`}>
        <div className={styles.orderIdentity}>
          <span className={styles.orderIcon}><AccountIcon name="orders" /></span>
          <div><small>Mã đơn hàng</small><strong title={order.id}>{order.id}</strong><small>{formatDate(order.created_at)}</small>
            {order.fulfillment_method && <small>{order.fulfillment_method === "TAI_CUA_HANG" ? "Nhận tại cửa hàng" : "Giao hàng tận nơi"}</small>}
          </div>
        </div>
        <span className={styles.badge} data-status={order.status}>{orderStatus[order.status] ?? "Chưa xác định"}</span>
        <div className={styles.orderValue}><small>Giá trị đơn hàng</small><strong>{formatMoney(order.total, order.currency)}</strong></div>
        <div className={styles.orderActions}>
          <Link className={styles.orderLink} href={`/main/orders/${encodeURIComponent(order.id)}`}>Xem chi tiết <span aria-hidden="true">→</span></Link>
          {!recent && <CancelOrderButton orderId={order.id} status={order.status} onCancelled={orders.reload} />}
          {order.status === "HOAN_THANH" && <Link className={styles.orderLink} href="/main/reviews">Đánh giá sản phẩm <span aria-hidden="true">→</span></Link>}
        </div>
        {order.payment_deadline && <div className={styles.orderDeadline}><PaymentDeadline orderId={order.id} deadline={order.payment_deadline} compact /></div>}
      </article>)}</div> : <div className={styles.empty}>
        <span className={styles.emptyIcon}><AccountIcon name="orders" /></span>
        <h3>{orders.data.pagination.total === 0 ? "Bạn chưa có đơn hàng nào." : "Không có đơn hàng trên trang này."}</h3>
        <p>Khám phá sản phẩm và chọn những món đồ bạn cần.</p>
        <Link className={styles.primaryLink} href="/main/product">Khám phá sản phẩm <span aria-hidden="true">→</span></Link>
      </div>}
      {recent ? onViewAll && orders.data.pagination.total > 5 && <button type="button" className={styles.orderLink} onClick={onViewAll}>Xem tất cả đơn hàng →</button> : <Pager pagination={orders.data.pagination} onPage={setPage} />}
    </>}
  </Panel>;
}
