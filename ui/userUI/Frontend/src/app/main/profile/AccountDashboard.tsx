"use client";
import { useId, useState } from "react";
import {
  CustomerGate,
  useShopping,
} from "@/components/shopping/ShoppingProvider";
import { OrderHistory } from "@/components/shopping/OrderHistory";
import styles from "./profile.module.css";
const views = [
  { id: "dashboard", label: "Tổng quan tài khoản" },
  { id: "account", label: "Thông tin tài khoản" },
  { id: "addresses", label: "Địa chỉ nhận hàng" },
  { id: "orders", label: "Đơn hàng của tôi" },
  { id: "payments", label: "Thanh toán đơn hàng" },
] as const;
export function AccountDashboard() {
  const shop = useShopping();
  return (
    <CustomerGate>
      {shop.customer && <Dashboard key={shop.customer.customer_id} />}
    </CustomerGate>
  );
}
function Dashboard() {
  const shop = useShopping();
  const customer = shop.customer!;
  const id = useId();
  const [view, setView] = useState<string>("dashboard");
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <nav className={styles.navigation} aria-label="Tài khoản của tôi">
          <ul>
            {views.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={view === item.id ? "page" : undefined}
                  aria-controls={id}
                  onClick={() => setView(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div id={id} className={styles.content}>
        {["dashboard", "account"].includes(view) && (
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>Thông tin tài khoản</h2>
            </div>
            <div className={styles.detailsGrid}>
              <div className={styles.detail}>
                <h3>{customer.name}</h3>
                <p>{customer.phone || "Chưa có số điện thoại"}</p>
              </div>
            </div>
          </section>
        )}
        {["dashboard", "addresses"].includes(view) && (
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <h2>Địa chỉ nhận hàng mặc định</h2>
            </div>
            <p>
              {[customer.address_line, customer.ward, customer.province]
                .filter(Boolean)
                .join(", ") ||
                "Chưa có địa chỉ mặc định. Bạn có thể nhập người nhận khi đặt đơn."}
            </p>
          </section>
        )}
        {["dashboard", "orders", "payments"].includes(view) && <OrderHistory />}
        {view === "payments" && (
          <p>
            Chọn “Xem thanh toán” ở đơn hàng để xem trạng thái và lịch sử giao
            dịch.
          </p>
        )}
      </div>
    </div>
  );
}
