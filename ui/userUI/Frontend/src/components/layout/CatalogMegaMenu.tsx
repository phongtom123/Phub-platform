"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { emptyFilters } from "@/components/catalog/catalogData";
import { CatalogImage } from "@/components/common/CatalogImage";
import { getProducts } from "@/lib/catalog/client";
import { categoryHref } from "@/lib/catalog/categories";
import { catalogProduct, productHref, type CatalogCategory } from "@/lib/catalog/types";
import styles from "./Header.module.css";

const BRAND_LOGOS: Record<string, string> = {
  adata: "/images/brands/adata.png",
  gigabyte: "/images/brands/gigabyte.png",
  hp: "/images/brands/hp.png",
  msi: "/images/brands/msi.png",
  razer: "/images/brands/razer.png",
  roccat: "/images/brands/roccat.png",
  thermaltake: "/images/brands/thermaltake.png",
};
type MegaProduct = ReturnType<typeof catalogProduct>;
const productCache = new Map<string, MegaProduct[]>();
const EMPTY_PRODUCTS: MegaProduct[] = [];

function brandLogo(brand: string) {
  const normalized = brand.toLocaleLowerCase("vi");
  return Object.entries(BRAND_LOGOS).find(([name]) => normalized.includes(name))?.[1];
}

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency", currency, maximumFractionDigits: 0,
  }).format(amount);
}

export function CatalogMegaMenu({ category, onNavigate, onKeepOpen }: {
  category: CatalogCategory;
  onNavigate: () => void;
  onKeepOpen?: () => void;
}) {
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null);
  const activeSubcategory = category.children.find(child => child.id === activeSubcategoryId) ?? null;
  const key = activeSubcategory ? `subcategory:${activeSubcategory.id}` : `category:${category.id}`;
  const viewAllHref = categoryHref(category.id, activeSubcategory?.id);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    products: MegaProduct[];
    error: string | null;
  }>(() => ({ key: productCache.has(key) ? key : "", products: productCache.get(key) ?? [], error: null }));

  useEffect(() => {
    if (productCache.has(key)) return;
    const controller = new AbortController();
    getProducts({
      q: "",
      filters: {
        ...emptyFilters,
        categories: activeSubcategory ? [] : [category.id],
        subcategories: activeSubcategory ? [activeSubcategory.id] : [],
      },
      sort: "position",
      page: 1,
      pageSize: 20,
      view: "grid",
    }, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) {
          const products = result.items.map(catalogProduct);
          productCache.set(key, products);
          setState({ key, products, error: null });
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setState({
            key,
            products: [],
            error: error instanceof Error ? error.message : "Không thể tải sản phẩm nổi bật.",
          });
        }
      });
    return () => controller.abort();
  }, [activeSubcategory, attempt, category.id, key]);

  const products = productCache.get(key) ?? (state.key === key ? state.products : EMPTY_PRODUCTS);
  const error = state.key === key ? state.error : null;
  const loading = !productCache.has(key) && state.key !== key;
  const featured = loading ? [] : products.slice(0, 4);
  const brands = useMemo(() => Array.from(new Set(
    (loading ? EMPTY_PRODUCTS : products).map(product => product.brand).filter(Boolean),
  )).slice(0, 7), [loading, products]);

  function brandHref(brand: string) {
    const params = new URLSearchParams({ brand });
    params.set(activeSubcategory ? "subcategory_id" : "category_id", activeSubcategory?.id ?? category.id);
    return `/main/product?${params}`;
  }

  return (
    <section className={styles.megaMenu} aria-label={`Danh mục ${category.label}`} onMouseEnter={onKeepOpen}>
      <aside className={styles.megaCategories} aria-label="Danh mục con">
        <Link className={styles.megaCategoryAll} data-active={!activeSubcategory}
          href={categoryHref(category.id)} onClick={onNavigate}
          onMouseEnter={() => setActiveSubcategoryId(null)} onFocus={() => setActiveSubcategoryId(null)}>
          <span>Xem tất cả {category.label}</span><span aria-hidden="true">›</span>
        </Link>
        {category.children.map(child => (
          <Link key={child.id} data-active={activeSubcategoryId === child.id}
            href={categoryHref(category.id, child.id)} onClick={onNavigate}
            onMouseEnter={() => setActiveSubcategoryId(child.id)} onFocus={() => setActiveSubcategoryId(child.id)}>
            <span>{child.label}</span><span aria-hidden="true">›</span>
          </Link>
        ))}
      </aside>

      <div className={styles.megaProducts}>
        <div className={styles.megaHeading}>
          <strong>{activeSubcategory ? `Gợi ý cho ${activeSubcategory.label}` : "Sản phẩm nổi bật"}</strong>
          <Link href={viewAllHref} onClick={onNavigate}>Xem toàn bộ</Link>
        </div>
        {loading && <p className={styles.megaStatus} role="status">Đang tải sản phẩm…</p>}
        {!loading && error && <div className={styles.megaStatus} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => {
            productCache.delete(key);
            setState({ key: "", products: [], error: null });
            setAttempt(value => value + 1);
          }}>Thử lại</button>
        </div>}
        {!loading && !error && !featured.length && <p className={styles.megaStatus}>Chưa có sản phẩm trong danh mục này.</p>}
        {!loading && !error && featured.length > 0 && <div key={key} className={styles.megaProductGrid}>
          {featured.map(product => (
            <article key={product.id} className={styles.megaProductCard}>
              <span className={styles.megaStock}><i aria-hidden="true" /> Còn hàng</span>
              <Link className={styles.megaProductImage} href={productHref(product.id)} onClick={onNavigate}>
                <CatalogImage src={product.imageSrc} alt={product.name} width={150} height={120} />
              </Link>
              <Link className={styles.megaProductName} href={productHref(product.id)} onClick={onNavigate}>
                {product.name}
              </Link>
              <strong className={styles.megaPrice}>{money(product.amount, product.currency ?? "VND")}</strong>
            </article>
          ))}
        </div>}
      </div>

      {brands.length > 0 && <div className={styles.megaBrands} aria-label="Thương hiệu nổi bật">
        {brands.map(brand => {
          const logo = brandLogo(brand);
          return <Link key={brand} href={brandHref(brand)} onClick={onNavigate} title={brand}>
            {logo ? <Image src={logo} alt={brand} width={124} height={42} /> : <span>{brand}</span>}
          </Link>;
        })}
      </div>}
    </section>
  );
}
