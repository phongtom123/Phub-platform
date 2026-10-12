import Link from "next/link";

export default function ProductNotFound() {
  return <section style={{ padding: "48px 24px", textAlign: "center" }}>
    <h1>Không tìm thấy sản phẩm</h1><p>Sản phẩm không tồn tại hoặc hiện không được bán.</p><Link href="/main/product">Về danh sách sản phẩm</Link>
  </section>;
}
