"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { parseProfile } from "@/lib/account/client";
import { useAccountResource } from "@/lib/account/useAccountResource";
import { safeImageUrl } from "@/lib/catalog/types";
import type { SessionUser } from "../../../../../../shared/auth-client";
import { AccountEditor } from "./AccountEditor";
import { AccountIcon } from "./AccountIcon";
import { AccountOrders } from "./AccountOrders";
import { DataState, Panel } from "./AccountPanels";
import { accountNavigation, type AccountView } from "./accountData";
import styles from "./profile.module.css";

export function AccountDashboard({ account, logout, loggingOut, logoutError }: { account: SessionUser; logout: () => void; loggingOut: boolean; logoutError: string }) {
  const [view, setView] = useState<AccountView>("account");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const profile = useAccountResource("customer/me", parseProfile);
  const person = profile.data;
  const displayName = person?.name || account.name;
  const initials = displayName.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();
  const address = person && [person.address_line, person.ward, person.province].filter(Boolean).join(", ");
  function navigate(next: AccountView) { setView(next); setNotice(""); }
  function edit() { setNotice(""); setEditing(true); }

  const addressCard = <Panel title="Địa chỉ giao hàng" action={<button className={styles.textAction} disabled={!person} onClick={edit} aria-label="Chỉnh sửa địa chỉ giao hàng">{address ? "Chỉnh sửa" : "Thêm địa chỉ"}</button>}>
    {person && (address ? <div className={styles.address}>
      <span className={styles.addressTag}>Địa chỉ mặc định</span>
      <h3>{person.name}</h3>
      {person.phone && <p className={styles.addressPhone}>{person.phone}</p>}
      <p>{address}</p>
    </div> : <div className={styles.emptyAddress}><AccountIcon name="addresses" /><p>Thêm địa chỉ để đặt hàng thuận tiện hơn.</p></div>)}
  </Panel>;

  return <div className={styles.layout}>
    <aside className={styles.sidebar}>
      <div className={styles.identity}>
        <div className={styles.avatar} aria-hidden="true">{initials}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {person?.avatar_url && <img key={person.avatar_url} src={safeImageUrl(person.avatar_url)} alt="" onError={event => { event.currentTarget.style.display = "none"; }} />}
        </div>
        <div><p>Xin chào,</p><h2>{displayName}</h2><span>Tài khoản khách hàng</span></div>
      </div>
      <nav className={styles.navigation} aria-label="Quản lý tài khoản">
        {accountNavigation.map(item => <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><AccountIcon name={item.id} /><span>{item.label}</span><span className={styles.navArrow} aria-hidden="true">›</span></button>)}
      </nav>
      <div className={styles.sidebarActions}><button className={styles.logout} onClick={logout} disabled={loggingOut}>{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</button></div>
    </aside>

    <div className={styles.content}>
      {logoutError && <p role="alert" className={styles.error}>{logoutError}</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {view !== "orders" && <DataState {...profile} />}
      {view === "account" && <>
        <Panel title="Thông tin cá nhân" action={<Button className={styles.secondaryButton} variant="outline" disabled={!person} onClick={edit}>Chỉnh sửa thông tin</Button>}>
          <p className={styles.sectionDescription}>Thông tin liên hệ và nhận hàng của bạn.</p>
          {person && <dl className={styles.profileFields}>
            <div><dt>Họ và tên</dt><dd>{person.name}</dd></div>
            <div><dt>Tên đăng nhập</dt><dd>{account.username}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{person.phone || "Chưa cập nhật"}</dd></div>
          </dl>}
        </Panel>
        <div className={styles.secondaryGrid}>
          {addressCard}
          <section className={styles.orderShortcut} aria-label="Theo dõi đơn hàng">
            <span className={styles.shortcutIcon}><AccountIcon name="orders" /></span>
            <h2>Đơn hàng của bạn</h2><p>Theo dõi trạng thái, xem hóa đơn và thông tin thanh toán của từng đơn.</p>
            <button className={styles.primaryLink} onClick={() => navigate("orders")}>Xem đơn hàng <span aria-hidden="true">→</span></button>
          </section>
        </div>
      </>}
      {view === "addresses" && addressCard}
      {view === "orders" && <AccountOrders />}
    </div>
    {editing && person && <AccountEditor profile={person} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); profile.reload(); setNotice("Đã lưu thông tin nhận hàng vào hồ sơ."); }} />}
  </div>;
}
