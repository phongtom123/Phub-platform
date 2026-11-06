"use client";
import Link from "next/link";
import { useCallback, useEffect } from "react";
import { useState } from "react";
import { cancelOrder, validateOrder } from "@/lib/shopping/client";
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
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const isCancelable = data && ["MOI", "XAC_NHAN", "DANG_CHUAN_BI"].includes(data.status);

  useEffect(() => {
    function onOrderChanged(event: Event) {
      if ((event as CustomEvent<{ orderId: string }>).detail?.orderId === id) reload();
    }
    window.addEventListener("phub:order-changed", onOrderChanged);
    return () => window.removeEventListener("phub:order-changed", onOrderChanged);
  }, [id, reload]);

  async function handleCancel() {
    if (cancelling) return;
    const confirmed = window.confirm(
      "Bạn có chắc chắn muốn hủy đơn hàng này không?\nNếu đơn đã được thanh toán, khoản tiền sẽ được hệ thống hoàn lại tự động."
    );
    if (!confirmed) return;
    setCancelling(true);
    setCancelError("");
    try {
      await cancelOrder(id);
      reload();
      window.dispatchEvent(new CustomEvent("phub:order-changed", { detail: { orderId: id } }));
      window.dispatchEvent(new Event("phub:invoice-changed"));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Không thể hủy đơn hàng. Vui lòng thử lại.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div className={styles.inline} style={{ marginBottom: 12 }}>
        <button type="button" onClick={reload} disabled={loading || cancelling}>
          Cập nhật đơn
        </button>
        {isCancelable && (
          <button
            type="button"
            className={styles.cancelButton}
            onClick={handleCancel}
            disabled={loading || cancelling}
          >
            {cancelling ? "Đang hủy đơn…" : "Hủy đơn hàng"}
          </button>
        )}
      </div>
      {cancelError && (
        <p className={styles.error} role="alert" style={{ marginBottom: 16 }}>
          ⚠️ {cancelError}
        </p>
      )}
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
            <p>Đơn đã hoàn thành. Bạn có thể chấm sao và chia sẻ nhận xét về sản phẩm.</p>
            <Link href="/main/reviews">Viết hoặc sửa đánh giá →</Link>
          </section>}
          <InvoicePanel orderId={data.id} onDeadlineChange={receiveDeadline} />
          <PaymentPanel orderId={data.id} orderStatus={data.status}
            paymentDeadline={deadlineSnapshot?.id === id ? deadlineSnapshot.value : data.payment_deadline} />
        </>
      )}
    </>
  );
}
