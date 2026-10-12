import Link from "next/link";
import { Button } from "@/components/common/Button";
import type { SessionUser } from "../../../../../shared/auth-client";
import { guestAccountItems } from "./headerData";
import styles from "./Header.module.css";

export function ShopInfo() {
  return <div className={styles.shopInfo}><p>Thông tin liên hệ và giờ mở cửa chưa được cấu hình.</p></div>;
}

export function AccountMenu({
  onNavigate,
  user,
  loading,
  onLogout,
}: {
  onNavigate: () => void;
  user: SessionUser | null;
  loading: boolean;
  onLogout: () => void;
}) {
  if (loading) return <p className={styles.accountIdentity}>Đang kiểm tra phiên đăng nhập…</p>;
  if (user) {
    const portal = user.role === "ADMIN"
      ? (process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000")
      : (process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "http://localhost:3002");
    return (
      <nav aria-label="Tài khoản" className={styles.accountMenu}>
        <p className={styles.accountIdentity}><strong>{user.name}</strong><span>@{user.username}</span></p>
        {user.role === "KHACH_HANG"
          ? <Link href="/main/profile" onClick={onNavigate}>Tài khoản của tôi</Link>
          : <a href={portal} onClick={onNavigate}>Mở cổng {user.role === "ADMIN" ? "quản trị" : "kho"}</a>}
        <button type="button" onClick={onLogout}>Đăng xuất</button>
      </nav>
    );
  }
  return (
    <nav aria-label="Tài khoản" className={styles.accountMenu}>
      {guestAccountItems.map((label, index) => <Link key={label} href={index === 0 ? "/auth/login" : "/auth/register"} onClick={onNavigate}>{label}</Link>)}
    </nav>
  );
}

export function GuestAvatar({ name }: { name?: string }) {
  return (
    <span className={styles.avatar}>
      {name ? <strong aria-hidden="true">{name.trim().charAt(0).toLocaleUpperCase("vi")}</strong> : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2Z" />
        </svg>
      )}
    </span>
  );
}

export function CartPreview({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className={styles.cartPreview}>
      <div className={styles.cartHead}>
        <h2>Giỏ hàng của tôi</h2>
        <p>Chưa kết nối API giỏ hàng.</p>
      </div>
      <Link href="/cart" className={styles.cartEdit} onClick={onNavigate}>Xem và Chỉnh Sửa Giỏ Hàng</Link>
      <div className={styles.cartItems}><p>Chưa thể tải sản phẩm trong giỏ.</p></div>
      <div className={styles.cartFoot}>
        <Button className={styles.checkout} disabled>Tiến Hành Thanh Toán</Button>
      </div>
    </div>
  );
}
