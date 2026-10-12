import Link from "next/link";
import styles from "./cart.module.css";
export function ShoppingCart() {
  return <main className={styles.page}><div className={styles.container}>
    <nav className={styles.breadcrumb}><Link href="/">Trang chủ</Link><span>›</span><Link href="/cart">Giỏ hàng</Link></nav>
    <h1>Giỏ hàng</h1><section className={styles.empty}><h2>Giỏ hàng chưa được kết nối</h2>
    <p>Không có sản phẩm tự thêm sẵn, mã giảm giá thử hoặc phí giao hàng giả. Chức năng giỏ hàng cần API trước khi sử dụng.</p>
    <Link href="/main/product">Xem sản phẩm</Link></section>
  </div></main>;
}
