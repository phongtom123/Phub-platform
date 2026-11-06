"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { PaymentDeadline } from "@/components/shopping/PaymentDeadline";
import { formatDate, formatMoney, orderStatus, parseOrders } from "@/lib/account/client";
import { useAccountResource } from "@/lib/account/useAccountResource";
import { AccountIcon } from "./AccountIcon";
import { DataState, Pager, Panel } from "./AccountPanels";
import styles from "./profile.module.css";

export function AccountOrders() {
  const [page, setPage] = useState(1);
  const orders = useAccountResource(`customer/orders?page=${page}&page_size=10`, parseOrders, 60000);
  return <Panel title="Đơn hàng của tôi" action={<Button className={styles.secondaryButton} variant="outline" disabled={orders.loading} onClick={orders.reload}>Làm mới đơn hàng</Button>}>
    <DataState {...orders} />
    {orders.data && <>
      <p className={styles.orderCount}>{orders.data.pagination.total} đơn hàng <span>Hóa đơn và thanh toán nằm trong chi tiết từng đơn.</span></p>
      {orders.data.items.length ? <div className={styles.orderList}>{orders.data.items.map(order => <article className={styles.orderCard} key={order.id} aria-label={`Đơn ${order.id}`}>
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
          {order.status === "HOAN_THANH" && <Link className={styles.orderLink} href="/main/reviews">Đánh giá sản phẩm <span aria-hidden="true">→</span></Link>}
        </div>
        {order.payment_deadline && <div className={styles.orderDeadline}><PaymentDeadline orderId={order.id} deadline={order.payment_deadline} compact /></div>}
      </article>)}</div> : <div className={styles.empty}>
        <span className={styles.emptyIcon}><AccountIcon name="orders" /></span>
        <h3>{orders.data.pagination.total === 0 ? "Bạn chưa có đơn hàng nào." : "Không có đơn hàng trên trang này."}</h3>
        <p>Khám phá sản phẩm và chọn những món đồ bạn cần.</p>
        <Link className={styles.primaryLink} href="/main/product">Khám phá sản phẩm <span aria-hidden="true">→</span></Link>
      </div>}
      <Pager pagination={orders.data.pagination} onPage={setPage} />
    </>}
  </Panel>;
}
