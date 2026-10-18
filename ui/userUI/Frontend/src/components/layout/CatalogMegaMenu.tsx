"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { emptyFilters } from "@/components/catalog/catalogData";
import { CatalogImage } from "@/components/common/CatalogImage";
import { getProducts } from "@/lib/catalog/client";
import { categoryHref } from "@/lib/catalog/categories";
import { catalogProduct, productHref, type CatalogCategory } from "@/lib/catalog/types";
import { resolveProductMediaUrl } from "@/lib/media";
import { prefetchOptimizedImage } from "@/lib/prefetchImage";
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
const productRequests = new Map<string, Promise<MegaProduct[]>>();
let catalogWarmRequest: Promise<void> | null = null;
const EMPTY_PRODUCTS: MegaProduct[] = [];

function menuKey(categoryId: string, subcategoryId?: string) {
  return subcategoryId ? `subcategory:${subcategoryId}` : `category:${categoryId}`;
}

function loadMenuProducts(categoryId: string, subcategoryId?: string): Promise<MegaProduct[]> {
  const key = menuKey(categoryId, subcategoryId);
  const cached = productCache.get(key);
  if (cached) return Promise.resolve(cached);
  if (catalogWarmRequest) {
    return catalogWarmRequest.then(() => productCache.get(key) ?? loadMenuProducts(categoryId, subcategoryId));
  }
  const pendingRequest = productRequests.get(key);
  if (pendingRequest) return pendingRequest;
  const request = getProducts({
    q: "",
    filters: {
      ...emptyFilters,
      categories: subcategoryId ? [] : [categoryId],
      subcategories: subcategoryId ? [subcategoryId] : [],
    },
    sort: "position",
    page: 1,
    pageSize: 20,
    view: "grid",
  }).then(result => {
    const products = result.items.map(catalogProduct);
    productCache.set(key, products);
    return products;
  }).finally(() => productRequests.delete(key));
  productRequests.set(key, request);
  return request;
}

function brandLogo(brand: string) {
  const normalized = brand.toLocaleLowerCase("vi");
  return Object.entries(BRAND_LOGOS).find(([name]) => normalized.includes(name))?.[1];
}

/** Fill mega-menu data and image caches after homepage product images get priority. */
export async function warmCatalogMegaMenu(categoryId: string, subcategoryId?: string) {
  const products = await loadMenuProducts(categoryId, subcategoryId);
  products.slice(0, 4).forEach(product => prefetchOptimizedImage(product.imageSrc, 150));
  Array.from(new Set(products.map(product => product.brand).filter(Boolean))).slice(0, 7).forEach(brand => {
    const logo = brandLogo(brand);
    if (logo) prefetchOptimizedImage(resolveProductMediaUrl(logo), 124);
  });
}

/** Fetch the catalog once, then populate every root/subcategory menu cache. */
export function warmAllCatalogMegaMenus(categories: CatalogCategory[]) {
  if (catalogWarmRequest) return catalogWarmRequest;
  const request = (async () => {
    const first = await getProducts({
      q: "", filters: emptyFilters, sort: "position", page: 1, pageSize: 100, view: "grid",
    });
    const products = first.items.map(catalogProduct);
    for (let page = 2; page <= first.pagination.total_pages; page += 1) {
      const result = await getProducts({
        q: "", filters: emptyFilters, sort: "position", page, pageSize: 100, view: "grid",
      });
      products.push(...result.items.map(catalogProduct));
    }
    categories.forEach(category => {
      productCache.set(menuKey(category.id), products.filter(product => product.category === category.id));
      category.children.forEach(child => {
        productCache.set(menuKey(category.id, child.id), products.filter(product => product.subcategory === child.id));
      });
    });
  })();
  catalogWarmRequest = request.finally(() => { catalogWarmRequest = null; });
  return catalogWarmRequest;
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
  const key = menuKey(category.id, activeSubcategory?.id);
  const viewAllHref = categoryHref(category.id, activeSubcategory?.id);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    products: MegaProduct[];
    error: string | null;
  }>(() => ({ key: productCache.has(key) ? key : "", products: productCache.get(key) ?? [], error: null }));

  useEffect(() => {
    if (productCache.has(key)) return;
    let active = true;
    loadMenuProducts(category.id, activeSubcategory?.id)
      .then(products => {
        if (active) setState({ key, products, error: null });
      })
      .catch(error => {
        if (active) {
          setState({
            key,
            products: [],
            error: error instanceof Error ? error.message : "Không thể tải sản phẩm nổi bật.",
          });
        }
      });
    return () => { active = false; };
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
          href={categoryHref(category.id)} prefetch={false} onClick={onNavigate}
          onMouseEnter={() => setActiveSubcategoryId(null)} onFocus={() => setActiveSubcategoryId(null)}>
          <span>Xem tất cả {category.label}</span><span aria-hidden="true">›</span>
        </Link>
        {category.children.map(child => (
          <Link key={child.id} data-active={activeSubcategoryId === child.id}
            href={categoryHref(category.id, child.id)} prefetch={false} onClick={onNavigate}
            onMouseEnter={() => setActiveSubcategoryId(child.id)} onFocus={() => setActiveSubcategoryId(child.id)}>
            <span>{child.label}</span><span aria-hidden="true">›</span>
          </Link>
        ))}
      </aside>

      <div className={styles.megaProducts}>
        <div className={styles.megaHeading}>
          <strong>{activeSubcategory ? `Gợi ý cho ${activeSubcategory.label}` : "Sản phẩm nổi bật"}</strong>
          <Link href={viewAllHref} prefetch={false} onClick={onNavigate}>Xem toàn bộ</Link>
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
              <Link className={styles.megaProductImage} href={productHref(product.id)} prefetch={false} onClick={onNavigate}>
                <CatalogImage src={product.imageSrc} alt={product.name} width={150} height={120} loading="eager" />
              </Link>
              <Link className={styles.megaProductName} href={productHref(product.id)} prefetch={false} onClick={onNavigate}>
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
          return <Link key={brand} href={brandHref(brand)} prefetch={false} onClick={onNavigate} title={brand}>
            {logo ? <Image src={resolveProductMediaUrl(logo)} alt={brand} width={124} height={42} loading="eager" /> : <span>{brand}</span>}
          </Link>;
        })}
      </div>}
    </section>
  );
}
