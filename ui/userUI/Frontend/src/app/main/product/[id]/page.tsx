import Link from "next/link";
import type { CSSProperties } from "react";
import { ProductTile } from "@/components/storefront/ProductTile";
import { formatCurrency, storeProducts } from "@/data/storefront-data";
import styles from "./detail.module.css";

const specifications = [
  ["Bảo hành", "36 tháng chính hãng"],
  ["Tình trạng", "Mới 100%, nguyên seal"],
  ["Giao hàng", "Toàn quốc"],
  ["Lắp đặt", "Miễn phí tại cửa hàng"],
];

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = storeProducts.find((item) => item.id === id) ?? storeProducts[0];
  const related = storeProducts.filter((item) => item.id !== product.id).slice(0, 4);
  const visualStyle = { "--detail-accent": product.accent } as CSSProperties;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}><Link href="/main/landing">Trang chủ</Link><span>/</span><Link href="/main/product">Sản phẩm</Link><span>/</span><strong>{product.brand}</strong></div>
      <section className={styles.product}>
        <div className={styles.visual} style={visualStyle}>
          <span>{product.brand}</span><strong>{product.visual}</strong><small>{product.visualDetail}</small>
        </div>
        <div className={styles.info}>
          <span className={styles.category}>{product.category}</span>
          <h1>{product.name}</h1>
          <div className={styles.rating}><span>★★★★★</span><small>{product.rating}/5 · {product.reviews} đánh giá</small></div>
          <p className={styles.description}>Sản phẩm chính hãng, được kiểm tra trước khi giao và hỗ trợ kỹ thuật trong suốt quá trình sử dụng.</p>
          <div className={styles.price}>{product.originalPrice && <del>{formatCurrency(product.originalPrice)}</del>}<strong>{formatCurrency(product.price)}</strong><small>Đã bao gồm VAT</small></div>
          <div className={styles.stock}><i /> Còn hàng tại kho trung tâm</div>
          <div className={styles.options}>
            <div><span>Số lượng</span><div className={styles.quantity}><button type="button">−</button><strong>1</strong><button type="button">+</button></div></div>
            <div><span>Dịch vụ</span><label><input type="radio" name="service" defaultChecked /> Giao hàng</label><label><input type="radio" name="service" /> Nhận tại cửa hàng</label></div>
          </div>
          <div className={styles.actions}><button type="button">Thêm vào giỏ hàng</button><button type="button">Mua ngay</button></div>
          <p className={styles.note}>Miễn phí giao hàng cho đơn từ 5.000.000đ · Hỗ trợ trả góp</p>
        </div>
      </section>
      <section className={styles.specSection}>
        <div><span>THÔNG TIN SẢN PHẨM</span><h2>An tâm trong từng lựa chọn</h2><p>Thông tin đang dùng dữ liệu mẫu và sẽ được đồng bộ từ hệ thống sản phẩm khi kết nối API.</p></div>
        <dl>{specifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>
      <section className={styles.related}>
        <div><span>CÓ THỂ BẠN QUAN TÂM</span><h2>Sản phẩm liên quan</h2></div>
        <div className={styles.grid}>{related.map((item) => <ProductTile key={item.id} product={item} />)}</div>
      </section>
    </div>
  );
}
