import styles from "./detail.module.css";
export function ProductDetailActions({ price, currency = "VND" }: { price: number; currency?: string }) {
  return <div className={styles.buyArea}>
    <p>Giá bán <strong>{new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(price)}</strong></p>
    <button className={styles.cartButton} type="button" disabled>Thêm vào giỏ</button>
    <p>Giỏ hàng và thanh toán chưa được kết nối API.</p>
  </div>;
}
