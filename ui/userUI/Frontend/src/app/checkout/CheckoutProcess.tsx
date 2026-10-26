import Link from "next/link";
import styles from "./checkout.module.css";
export function CheckoutProcess() {
  return <main className={styles.page}><div className={styles.container}>
    <nav className={styles.breadcrumb}><Link href="/">Trang chủ</Link><span>›</span><Link href="/cart">Giỏ hàng</Link><span>›</span><Link href="/checkout">Thanh toán</Link></nav>
    <h1>Thanh toán</h1><p>Chưa kết nối đầy đủ luồng giỏ hàng, báo giá và xác thực khách hàng. Không thể đặt đơn hoặc thu tiền tại đây.</p>
    <p>Tổng tiền, voucher và phí giao hàng phải do backend xác nhận; không tính giá trị mẫu trên UI.</p>
    <Link href="/main/product">Tiếp tục xem sản phẩm</Link>
  </div></main>;
}
