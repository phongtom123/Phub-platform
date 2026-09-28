import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import { guestAccountItems } from "./headerData";
import styles from "./Header.module.css";

export function ShopInfo() {
  return (
    <div className={styles.shopInfo}>
      <div className={styles.shopRow}>
        <Image src="/icons/header/clock.svg" alt="" width={35} height={35} />
        <div>
          <p><strong>Giờ mở cửa:</strong></p>
          <p><span>T2-T5:</span> <strong>9:00 AM - 5:30 PM</strong></p>
          <p><span>T6:</span> <strong>9:00 AM - 6:00 PM</strong></p>
          <p><span>T7:</span> <strong>11:00 AM - 5:00 PM</strong></p>
        </div>
      </div>
      <div className={styles.shopRow}>
        <Image src="/icons/header/location.svg" alt="" width={35} height={35} />
        <p><strong>Địa chỉ:</strong> 1234 Nguyễn Thị Minh Khai, Q1, HCM</p>
      </div>
      <div className={styles.shopContact}>
        <p>Điện thoại: <a href="tel:0901234567">090 123 4567</a></p>
        <p>E-mail: <a href="mailto:shop@techstore.vn">shop@techstore.vn</a></p>
      </div>
    </div>
  );
}

export function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  return (
    <nav aria-label="Tài khoản" className={styles.accountMenu}>
      {guestAccountItems.map(item => <Link key={item.href} href={item.href} onClick={onNavigate}>{item.label}</Link>)}
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

export function CartPreview({ onSelect }: { onSelect: (label: string) => void }) {
  return (
    <div className={styles.cartPreview}>
      <div className={styles.cartHead}>
        <h2>Giỏ hàng của tôi</h2>
        <p>0 sản phẩm</p>
      </div>
      <Button variant="outlinePrimary" className={styles.cartEdit} onClick={() => onSelect("Giỏ hàng")}>Xem và Chỉnh Sửa Giỏ Hàng</Button>
      <div className={styles.cartItems}><p>Giỏ hàng đang trống.</p></div>
      <div className={styles.cartFoot}>
        <p className={styles.subtotal}><span>Tạm tính:</span><strong>0 ₫</strong></p>
        <Button className={styles.checkout} disabled>Tiến Hành Thanh Toán</Button>
      </div>
    </div>
  );
}
