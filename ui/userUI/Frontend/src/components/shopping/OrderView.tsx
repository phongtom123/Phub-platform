"use client";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useState } from "react";
import { validateOrder } from "@/lib/shopping/client";
import { CancelOrderButton } from "./CancelOrderButton";
import { money } from "@/lib/shopping/money";
import { groupInvoiceLines } from "@/lib/shopping/invoice-lines";
import { CustomerGate, useShopping } from "./ShoppingProvider";
import { useCustomerResource } from "./useCustomerResource";
import { PaymentPanel } from "./PaymentPanel";
import { InvoicePanel } from "./InvoicePanel";
import type { PaymentDeadline } from "@/lib/shopping/types";
import { orderStatus } from "./OrderHistory";
import styles from "./shopping.module.css";
export function OrderView({ id }: { id: string }) {
  const shop = useShopping();
  return (
    <section className={styles.container}>
      <Link href="/main/profile">Tài khoản và lịch sử đơn</Link>
      <h1>Chi tiết đơn hàng</h1>
      {shop.customer?.demo_mode && <p className={styles.pending}>Chế độ thử nghiệm: đơn hàng và thanh toán là dữ liệu giả lập, không thu tiền thật.</p>}
      <CustomerGate>
        {shop.customer && <Details key={shop.customer.customer_id} id={id} />}
      </CustomerGate>
    </section>
  );
}
function Details({ id }: { id: string }) {
  const [deadlineSnapshot, setDeadlineSnapshot] = useState<{ id: string; value: PaymentDeadline | null } | null>(null);
  const receiveDeadline = useCallback((value: PaymentDeadline | null) => setDeadlineSnapshot({ id, value }), [id]);
  const { data, error, loading, reload } = useCustomerResource(
    `orders/${encodeURIComponent(id)}`,
    validateOrder,
  );

  useEffect(() => {
    function onOrderChanged(event: Event) {
      if ((event as CustomEvent<{ orderId: string }>).detail?.orderId === id) reload();
    }
    window.addEventListener("phub:order-changed", onOrderChanged);
    return () => window.removeEventListener("phub:order-changed", onOrderChanged);
  }, [id, reload]);

  return (
    <>
      <div className={styles.inline} style={{ marginBottom: 12 }}>
        <button type="button" onClick={reload} disabled={loading}>
          Cập nhật đơn
        </button>
        {data && <CancelOrderButton key={id} orderId={id} status={data.status} disabled={loading} onCancelled={reload} />}
      </div>
      {loading && <p role="status">Đang tải đơn…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <section className={styles.panel}>
            <h2>Đơn {data.id}</h2>
            <p>{orderStatus[data.status] || orderStatus.UNKNOWN}</p>
            <p>{data.created_at.replace("T", " ")}</p>
            {data.fulfillment_method && <p><strong>{data.fulfillment_method === "TAI_CUA_HANG" ? "Nhận tại cửa hàng" : "Giao hàng tận nơi"}</strong></p>}
            <p>
              Người nhận: {data.recipient.name || "Chưa ghi nhận"} ·{" "}
              {data.recipient.phone || "Chưa ghi nhận"}
            </p>
            {data.fulfillment_method !== "TAI_CUA_HANG" && <p>
              {[
                data.recipient.address_line,
                data.recipient.ward,
                data.recipient.province,
              ]
                .filter(Boolean)
                .join(", ") || "Chưa ghi nhận địa chỉ"}
            </p>}
            {data.note && <p>Ghi chú: {data.note}</p>}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Sản phẩm lúc bán</th>
                    <th>Số lượng</th>
                    <th>Đơn giá</th>
                    <th>Giảm giá</th>
                    <th>Thuế</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {groupInvoiceLines(data.items).map((line, index) => (
                    <tr key={index}>
                      <td>
                        {line.name}
                        <p>
                          SKU {line.sku} · {line.unit}
                        </p>
                      </td>
                      <td>{line.quantity}</td>
                      <td>{money(line.unit_price, data.currency)}</td>
                      <td>{money(line.discount, data.currency)}</td>
                      <td>{money(line.tax_amount, data.currency)}</td>
                      <td>{money(line.line_total, data.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={styles.total}>
              Tổng tiền trên đơn: {money(data.total, data.currency)}
            </p>
            <p className={styles.muted}>
              Số tiền này lấy từ các dòng đã chốt trên đơn. Thuế và phí khác của
              hóa đơn, nếu có, được xác nhận tại bước lập hóa đơn.
            </p>
          </section>
          {data.status === "HOAN_THANH" && <section className={styles.panel} aria-label="Đánh giá sau mua">
            <h2>Đánh giá sản phẩm đã mua</h2>
            <p>Đơn hàng đã hoàn thành. Bạn có thể chấm điểm 1–5 sao và chia sẻ nhận xét thực tế về sản phẩm.</p>
            <Link className={styles.reviewButton} href="/main/reviews">Viết hoặc sửa đánh giá sản phẩm →</Link>
          </section>}
          <InvoicePanel orderId={data.id} onDeadlineChange={receiveDeadline} />
          <PaymentPanel orderId={data.id} orderStatus={data.status}
            paymentDeadline={deadlineSnapshot?.id === id ? deadlineSnapshot.value : data.payment_deadline} />
        </>
      )}
    </>
  );
}
