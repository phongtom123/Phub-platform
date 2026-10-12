import Link from "next/link";
export function HeroBanner() {
  return <section aria-label="PHUB Store" style={{ padding: "40px 24px", background: "#f6f8fa", borderRadius: 12 }}>
    <h1>PC nguyên bộ và linh kiện máy tính</h1>
    <p>Tra cứu sản phẩm, giá bán và thông số từ catalog của cửa hàng.</p>
    <Link href="/main/product">Xem sản phẩm</Link>
  </section>;
}
