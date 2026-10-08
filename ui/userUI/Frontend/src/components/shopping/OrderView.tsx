"use client";
import Link from "next/link";
import { validateOrder } from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import { CustomerGate, useShopping } from "./ShoppingProvider";
import { useCustomerResource } from "./useCustomerResource";
import { PaymentPanel } from "./PaymentPanel";
import { InvoicePanel } from "./InvoicePanel";
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
  const { data, error, loading, reload } = useCustomerResource(
    `orders/${encodeURIComponent(id)}`,
    validateOrder,
  );
  return (
    <>
      <button type="button" onClick={reload}>
        Cập nhật đơn
      </button>
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
            <p>
              Người nhận: {data.recipient.name || "Chưa ghi nhận"} ·{" "}
              {data.recipient.phone || "Chưa ghi nhận"}
            </p>
            <p>
              {[
                data.recipient.address_line,
                data.recipient.ward,
                data.recipient.province,
              ]
                .filter(Boolean)
                .join(", ") || "Chưa ghi nhận địa chỉ"}
            </p>
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
                  {data.items.map((line, index) => (
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
          <InvoicePanel orderId={data.id} />
          <PaymentPanel orderId={data.id} />
        </>
      )}
    </>
  );
}
