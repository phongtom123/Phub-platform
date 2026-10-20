"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { formatDate, formatMoney, orderStatus, parseOrders, parseProfile } from "@/lib/account/client";
import { useAccountResource } from "@/lib/account/useAccountResource";
import type { SessionUser } from "../../../../../../shared/auth-client";
import { AccountEditor } from "./AccountEditor";
import { DataState, InvoicePanel, OrderPanel, Pager, Panel, PaymentPanels } from "./AccountPanels";
import { accountNavigation, type AccountView } from "./accountData";
import styles from "./profile.module.css";

const unsupported = {
  downloads: "Chưa có API sản phẩm tải xuống cho tài khoản.",
  payments: "Chưa có API lưu phương thức thanh toán. Bạn vẫn có thể xem giao dịch thu / hoàn tiền của từng đơn trong My Orders.",
  agreements: "Chưa có API thỏa thuận thanh toán cho tài khoản.",
  wishlist: "Chưa có API danh sách yêu thích của tài khoản.",
  reviews: "Chưa có API đánh giá sản phẩm của tài khoản.",
  newsletter: "Chưa có API đăng ký bản tin; chưa thể xác định trạng thái đăng ký.",
};
type OrderView = "orders" | "invoices" | "payments";

function AccountOrders() {
  const [mode, setMode] = useState<OrderView>("orders");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const orders = useAccountResource(`customer/orders?page=${page}&page_size=10`, parseOrders);
  function openOrder(id: string, next: OrderView) { setSelected(id); setMode(next); }
  return <>
    <div className={styles.actions}>
      {selected && <Button variant="outline" onClick={() => setSelected(null)}>← Quay lại danh sách</Button>}
      {(["orders", "invoices", "payments"] as const).map(tab => <button key={tab} className={styles.textAction} aria-pressed={mode === tab} onClick={() => setMode(tab)}>{tab === "orders" ? "Đơn hàng" : tab === "invoices" ? "Hóa đơn" : "Thanh toán"}</button>)}
    </div>
    {!selected ? <Panel title="My Orders" action={<button className={styles.textAction} disabled={orders.loading} onClick={orders.reload}>Làm mới đơn hàng</button>}>
      <DataState {...orders} />
      {orders.data && <>
        <p className={styles.note}>Tổng số đơn hàng: {orders.data.pagination.total}</p>
        {(mode === "invoices" || mode === "payments") && <p className={styles.note}>Chọn đơn để xem {mode === "invoices" ? "hóa đơn" : "giao dịch và lịch sử thanh toán"}.</p>}
        {orders.data.items.length ? <div className={styles.orderList}>{orders.data.items.map(order => <article className={styles.orderCard} key={order.id} aria-label={`Đơn ${order.id}`}>
          <div><strong>{order.id}</strong><small>{formatDate(order.created_at)}</small><span className={styles.badge}>{orderStatus[order.status] ?? "Chưa xác định"}</span></div>
          <div><span className={styles.orderAmount}>{formatMoney(order.total, order.currency)}</span><small>Giá trị đơn, không phải tiền đã thu</small></div>
          <div className={styles.orderActions}><Button variant="outline" onClick={() => openOrder(order.id, mode)}>{mode === "invoices" ? "Xem hóa đơn" : mode === "payments" ? "Xem thanh toán" : "Chi tiết đơn"}</Button>{mode === "orders" && <><button className={styles.textAction} onClick={() => openOrder(order.id, "invoices")}>Hóa đơn</button><button className={styles.textAction} onClick={() => openOrder(order.id, "payments")}>Thanh toán</button></>}</div>
        </article>)}</div> : <div className={styles.empty}><p>{orders.data.pagination.total === 0 ? "Bạn chưa có đơn hàng nào." : "Không có đơn hàng trên trang này."}</p><Link href="/main/product">Khám phá sản phẩm</Link></div>}
        <Pager pagination={orders.data.pagination} onPage={setPage} />
      </>}
    </Panel> : <>
      {mode === "orders" && <OrderPanel key={selected} orderId={selected} />}
      {mode === "invoices" && <InvoicePanel key={selected} orderId={selected} />}
      {mode === "payments" && <PaymentPanels key={selected} orderId={selected} />}
    </>}
  </>;
}

export function AccountDashboard({ account, logout, loggingOut, logoutError }: { account: SessionUser; logout: () => void; loggingOut: boolean; logoutError: string }) {
  const [view, setView] = useState<AccountView>("dashboard");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [ordersVersion, setOrdersVersion] = useState(0);
  const profile = useAccountResource("customer/me", parseProfile);
  const person = profile.data;
  function navigate(next: AccountView) { setView(next); setNotice(""); if (next === "orders") setOrdersVersion(value => value + 1); }
  function edit() { setNotice(""); setEditing(true); }
  const address = person && [person.address_line, person.ward, person.province].filter(Boolean).join(", ");
  const showAccount = view === "dashboard" || view === "account";
  const showAddresses = view === "dashboard" || view === "addresses";
  return <div className={styles.layout}>
    <aside className={styles.sidebar}>
      <nav className={styles.navigation} aria-label="Quản lý tài khoản">
        {accountNavigation.map((group, index) => <ul key={index}>{group.map(item => <li key={item.id}><button aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>{item.label}</button></li>)}</ul>)}
      </nav>
      <section className={styles.summaryBox} aria-label="Compare Products"><h2>Compare Products</h2><p>Chưa có API danh sách so sánh của tài khoản.</p></section>
      <section className={styles.summaryBox} aria-label="My Wish List"><h2>My Wish List</h2><p>Chưa có API danh sách yêu thích của tài khoản.</p></section>
      <div className={styles.sidebarActions}><button className={styles.textAction} disabled={profile.loading} onClick={profile.reload}>Làm mới</button><button className={styles.textAction} onClick={logout} disabled={loggingOut}>{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</button></div>
    </aside>
    <div className={styles.content}>
      {logoutError && <p role="alert" className={styles.error}>{logoutError}</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {showAccount && <section className={styles.section} aria-label="Account Information">
        <div className={styles.sectionHeading}><h2>Account Information</h2></div>
        <div className={styles.detailsGrid}>
          <section className={styles.detail} aria-label="Contact Information">
            <h3>Contact Information</h3>
            <DataState {...profile} />
            {person && <p><span>{person.name}</span><span>Tên đăng nhập: {account.username}</span>{person.phone && <span>{person.phone}</span>}</p>}
            <div className={styles.links}><button aria-label="Sửa thông tin nhận hàng" disabled={!person} onClick={edit}>Edit</button><button onClick={() => setNotice("Chưa có API đổi mật khẩu cho khách hàng.")}>Change Password</button></div>
          </section>
          <section className={styles.detail} aria-label="Newsletters">
            <h3>Newsletters</h3><p>Chưa có API để tra cứu đăng ký bản tin.</p>
            <div className={styles.links}><button aria-label="Edit newsletters" onClick={() => navigate("newsletter")}>Edit</button></div>
          </section>
        </div>
      </section>}
      {showAddresses && <section className={styles.section} aria-label="Address Book">
        <div className={styles.sectionHeading}><h2>Address Book</h2><button className={styles.textAction} onClick={() => navigate("addresses")}>Manage Addresses</button></div>
        {!showAccount && <DataState {...profile} />}
        <div className={styles.detailsGrid}>
          <section className={styles.detail} aria-label="Default Billing Address">
            <h3>Default Billing Address</h3><p>API chưa hỗ trợ địa chỉ thanh toán riêng.</p>
            <div className={styles.links}><button aria-label="Edit billing address" onClick={() => setNotice("Chưa có API địa chỉ thanh toán riêng. Bạn có thể sửa địa chỉ nhận hàng mặc định ở cột bên cạnh.")}>Edit Address</button></div>
          </section>
          <section className={styles.detail} aria-label="Default Shipping Address">
            <h3>Default Shipping Address</h3>
            {person ? <p>{address ? <>{person.name}<br />{address}<br />{person.phone}</> : "Bạn chưa cập nhật địa chỉ nhận hàng mặc định."}</p> : <p>{profile.loading ? "Đang tải địa chỉ…" : "Không thể tải địa chỉ."}</p>}
            <div className={styles.links}><button aria-label="Edit shipping address" disabled={!person} onClick={edit}>Edit Address</button></div>
          </section>
        </div>
      </section>}
      {view === "orders" && <AccountOrders key={ordersVersion} />}
      {view in unsupported && <section className={styles.section} aria-label={accountNavigation.flat().find(item => item.id === view)?.label}>
        <div className={styles.sectionHeading}><h2>{accountNavigation.flat().find(item => item.id === view)?.label}</h2></div>
        <p className={styles.empty}>{unsupported[view as keyof typeof unsupported]}</p>
        {view === "payments" && <div className={styles.links}><button onClick={() => navigate("orders")}>Xem lịch sử thanh toán theo đơn</button></div>}
      </section>}
    </div>
    {editing && person && <AccountEditor profile={person} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); profile.reload(); setNotice("Đã lưu thông tin nhận hàng vào hồ sơ."); }} />}
  </div>;
}
