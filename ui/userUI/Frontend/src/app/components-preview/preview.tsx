import Link from "next/link";
export function ComponentPreview() {
  return <main style={{ padding: 32 }}><h1>Component UI</h1><p>Đã bỏ các sản phẩm, giá, đánh giá và giỏ hàng minh họa khỏi trang preview.</p><Link href="/main/product">Xem catalog từ API</Link></main>;
}
