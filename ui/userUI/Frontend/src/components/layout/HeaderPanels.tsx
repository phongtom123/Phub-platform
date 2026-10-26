import Link from "next/link";
import { Button } from "@/components/common/Button";
import { guestAccountItems } from "./headerData";
import styles from "./Header.module.css";

export function ShopInfo() {
  return <div className={styles.shopInfo}><p>Thông tin liên hệ và giờ mở cửa chưa được cấu hình.</p></div>;
}

export function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav aria-label="Tài khoản" className={styles.accountMenu}>
      {guestAccountItems.map((label, index) => <Link key={label} href={index === 0 ? "/auth/login" : "/auth/register"} onClick={onNavigate}>{label}</Link>)}
    </nav>
  );
}

export function GuestAvatar() {
  return (
    <span className={styles.avatar}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2Z" />
      </svg>
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
