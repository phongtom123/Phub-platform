"use client";

import { useId, useState } from "react";
import { BrandTile } from "@/components/common/BrandTile";
import { ProductCard } from "@/components/common/ProductCard";
import { laptopMenuCategories, megaMenuBrands, megaMenuProducts, type MenuCategory } from "./megaMenuData";
import styles from "./MegaMenu.module.css";

export function MegaMenu({ onClose }: { onClose: () => void }) {
  const id = useId();
  const [path, setPath] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const columns: (readonly MenuCategory[])[] = [laptopMenuCategories];
  const labels: string[] = [];
  let branch: readonly MenuCategory[] | undefined = laptopMenuCategories;
  for (const selectedId of path) {
    const selected: MenuCategory | undefined = branch?.find(item => item.id === selectedId);
    if (!selected) break;
    labels.push(selected.label);
    branch = selected.children;
    if (branch) columns.push(branch);
  }
  const products = path.length ? megaMenuProducts.slice(0, 1) : megaMenuProducts;

  function selectCategory(level: number, item: MenuCategory) {
    setPath(current => [...current.slice(0, level), item.id]);
    setSelectedProduct("");
  }

  return (
    <section className={styles.menu} aria-label="Mega menu Laptops">
      <div className={styles.toolbar}>
        <span>Dữ liệu mẫu · Laptops</span>
        <div>
          {path.length > 0 && <button type="button" onClick={() => { setPath([]); setSelectedProduct(""); }}>← Tất cả laptop</button>}
          <button type="button" onClick={onClose} aria-label="Đóng mega menu">×</button>
        </div>
      </div>
      <div className={styles.content}>
        {columns.map((items, level) => <nav key={level} id={id + "-column-" + level} className={styles.column} aria-label={"Danh mục cấp " + (level + 1)}>
          <ul>{items.map(item => <li key={item.id}>
            <button type="button" aria-pressed={path[level] === item.id}
              aria-expanded={item.children ? path[level] === item.id : undefined}
              aria-controls={item.children && path[level] === item.id ? id + "-column-" + (level + 1) : undefined}
              onPointerEnter={event => { if (event.pointerType === "mouse" && !event.currentTarget.parentElement?.parentElement?.contains(document.activeElement)) selectCategory(level, item); }}
              onClick={() => selectCategory(level, item)}>
              <span>{item.label} {item.count !== undefined && <small>({item.count})</small>}</span>
              {item.children && <span aria-hidden="true">›</span>}
            </button>
          </li>)}</ul>
        </nav>)}
        <div className={styles.products} data-expanded={path.length > 0} aria-label="Sản phẩm mẫu">
          {products.map(product => <ProductCard key={product.id} {...product} className={styles.product}
            href="#" imageSrc="/images/tech-store/msi-pro-16.png" currency="VND" locale="vi-VN" stock="in-stock"
            onSelect={() => setSelectedProduct(product.name)} />)}
        </div>
      </div>
      <p className={styles.selection} role="status">{selectedProduct ? "Bạn đang xem mẫu: " + selectedProduct : labels.length ? labels.join(" / ") + " — sản phẩm minh họa" : "Chọn danh mục để xem menu nhiều cấp. Giá và cấu hình chỉ dùng minh họa."}</p>
      <div className={styles.brands} aria-label="Thương hiệu">
        {megaMenuBrands.map(brand => <BrandTile key={brand.id} name={brand.name} src={"/images/brands/" + brand.id + ".png"} width={153} height={80} containerClassName={styles.brand} />)}
      </div>
    </section>
  );
}
