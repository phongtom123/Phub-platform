import type { Metadata } from "next";
import Link from "next/link";
import { ProductTile } from "@/components/storefront/ProductTile";
import { storeCategories, storeProducts } from "@/data/storefront-data";
import styles from "./product.module.css";

export const metadata: Metadata = {
  title: "Sản phẩm | PHUB Store",
  description: "Danh mục PC, laptop và linh kiện máy tính tại PHUB Store.",
};

export default async function ProductPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const rawCategory = (await searchParams).category;
  const activeCategory = typeof rawCategory === "string" ? rawCategory : "";
  const products = activeCategory
    ? storeProducts.filter((product) => product.categoryId === activeCategory)
    : storeProducts;
  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}><Link href="/main/landing">Trang chủ</Link><span>/</span><strong>Sản phẩm</strong></div>
      <section className={styles.intro}>
        <div><span>PHUB CATALOG</span><h1>PC và linh kiện</h1><p>Khám phá cấu hình, thiết bị và phụ kiện phù hợp với công việc của bạn.</p></div>
        <div className={styles.result}><strong>{products.length}</strong><span>sản phẩm mẫu</span></div>
      </section>
      <nav className={styles.categoryNav} aria-label="Lọc theo danh mục">
        <Link href="/main/product" className={!activeCategory ? styles.active : undefined}>Tất cả</Link>
        {storeCategories.map((category) => <Link className={activeCategory === category.id ? styles.active : undefined} key={category.id} href={`/main/product?category=${category.id}`}>{category.name}</Link>)}
      </nav>
      <div className={styles.catalogLayout}>
        <aside className={styles.filters}>
          <div><span>BỘ LỌC</span><button type="button">Đặt lại</button></div>
          <section><h2>Khoảng giá</h2><label><input type="checkbox" /> Dưới 5 triệu</label><label><input type="checkbox" /> 5 – 15 triệu</label><label><input type="checkbox" /> 15 – 30 triệu</label><label><input type="checkbox" /> Trên 30 triệu</label></section>
          <section><h2>Thương hiệu</h2>{["PHUB", "MSI", "Gigabyte", "Samsung", "Corsair", "Razer"].map((brand) => <label key={brand}><input type="checkbox" /> {brand}</label>)}</section>
          <section><h2>Tình trạng</h2><label><input type="checkbox" defaultChecked /> Còn hàng</label><label><input type="checkbox" /> Đang khuyến mãi</label></section>
        </aside>
        <main className={styles.products}>
          <div className={styles.toolbar}><p>Hiển thị <strong>{products.length}</strong> sản phẩm</p><label>Sắp xếp <select defaultValue="featured"><option value="featured">Nổi bật</option><option value="low">Giá thấp đến cao</option><option value="high">Giá cao đến thấp</option></select></label></div>
          <div className={styles.grid}>{products.map((product) => <ProductTile key={product.id} product={product} />)}</div>
        </main>
      </div>
    </div>
  );
}
