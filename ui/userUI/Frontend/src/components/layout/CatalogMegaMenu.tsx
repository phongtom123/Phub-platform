"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { emptyFilters } from "@/components/catalog/catalogData";
import { CatalogImage } from "@/components/common/CatalogImage";
import { getProducts } from "@/lib/catalog/client";
import { categoryHref } from "@/lib/catalog/categories";
import { useCatalogFacets } from "@/lib/catalog/useCatalogFacets";
import { safeImageUrl, type ApiProduct, type CatalogCategory } from "@/lib/catalog/types";
import styles from "./CatalogMegaMenu.module.css";

// This sample supplies decorative thumbnails, never the available filter choices.
const thumbnails = new Map<string, ApiProduct[]>();
const priceRanges = [
  { label: "Dưới 5 triệu", max: "4999999" },
  { label: "5 – 10 triệu", min: "5000000", max: "9999999" },
  { label: "10 – 20 triệu", min: "10000000", max: "19999999" },
  { label: "20 – 40 triệu", min: "20000000", max: "39999999" },
  { label: "Từ 40 triệu", min: "40000000" },
];

export function CategoryMenuIcon({ label }: { label: string }) {
  const value = label.toLocaleLowerCase("vi");
  const path = /linh kiện|cpu|ram|chip|xử lý/.test(value)
    ? "M8 8h8v8H8zM4 9h4m-4 6h4m8-6h4m-4 6h4M9 4v4m6-4v4M9 16v4m6-4v4"
    : /giá|triệu/.test(value)
      ? "m3 11 8-8h8l2 2v8l-8 8zM16 7h.01M9 12l3 3m0-6 3 3"
      : /phụ kiện|chuột|bàn phím/.test(value)
        ? "M8 11V8a4 4 0 0 1 8 0v3m-9 0h10v5a5 5 0 0 1-10 0zM12 11v4"
        : "M3 4h18v13H3zM8 21h8m-4-4v4M6 7h12";
  return <svg className={styles.icon} width="30" height="30" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

type MenuOption = { label: string; href: string; image?: string };

function MenuGroup({ title, options, onNavigate }: { title: string; options: MenuOption[]; onNavigate: () => void }) {
  if (!options.length) return null;
  return <section className={styles.group} aria-label={title}>
    <h3>{title}</h3>
    <div className={styles.tiles}>
      {options.map(option => <Link key={option.href} href={option.href} title={option.label} prefetch={false} onClick={onNavigate}>
        <span className={styles.visual}>{option.image
          ? <CatalogImage src={option.image} alt="" width={36} height={36} />
          : <CategoryMenuIcon label={title} />}</span>
        <span>{option.label.replace(/^(Bộ vi xử lý|Card màn hình|Bo mạch chủ|Nguồn máy tính|Ổ cứng)\s+/iu, "")}</span>
      </Link>)}
    </div>
  </section>;
}

export function CatalogMegaMenu({ id, category, onNavigate }: {
  id: string; category: CatalogCategory; onNavigate: () => void;
}) {
  const facets = useCatalogFacets({ q: "", filters: { ...emptyFilters, categories: [category.id] },
    sort: "position", page: 1, pageSize: 20, view: "grid" });
  const [products, setProducts] = useState<ApiProduct[]>(() => thumbnails.get(category.id) ?? []);

  useEffect(() => {
    if (thumbnails.has(category.id)) return;
    const controller = new AbortController();
    getProducts({ q: "", filters: { ...emptyFilters, categories: [category.id] },
      sort: "position", page: 1, pageSize: 20, view: "grid" }, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (thumbnails.size >= 30) thumbnails.delete(thumbnails.keys().next().value!);
      thumbnails.set(category.id, result.items);
      setProducts(result.items);
    }).catch(() => { /* Category icons remain usable without thumbnails. */ });
    return () => controller.abort();
  }, [category.id]);

  function href(values: Record<string, string>) {
    return `/main/product?${new URLSearchParams({ category_id: category.id, ...values })}`;
  }
  function thumbnail(test: (product: ApiProduct) => boolean) {
    const image = products.find(product => test(product) && product.images.length)?.images[0]?.url;
    return image ? safeImageUrl(image) : undefined;
  }
  const children = category.children.map(child => ({ label: child.label,
    href: href({ subcategory_id: child.id }), image: thumbnail(product => product.subcategory.id === child.id) }));
  const brands = (facets.data?.brands ?? []).filter(brand => brand.count > 0).map(brand => ({
    label: brand.label, href: href({ brand: brand.value }), image: thumbnail(product => product.brand === brand.value),
  }));

  return <section id={id} className={styles.menu} aria-label={`Danh mục ${category.label}`}>
    <div className={styles.heading}><h2>{category.label}</h2>
      <Link href={categoryHref(category.id)} prefetch={false} onClick={onNavigate}>Xem tất cả <span aria-hidden="true">→</span></Link>
    </div>
    <div className={styles.columns}>
      <div className={styles.column}>
        <MenuGroup title="Loại sản phẩm" options={children} onNavigate={onNavigate} />
        <MenuGroup title="Theo mức giá" options={priceRanges.map(range => ({ label: range.label,
          href: href({ ...(range.min ? { min_price: range.min } : {}), ...(range.max ? { max_price: range.max } : {}) }),
        }))} onNavigate={onNavigate} />
      </div>
      <div className={styles.column}>
        <MenuGroup title="Theo thương hiệu" options={brands} onNavigate={onNavigate} />
        {(facets.data?.specs ?? []).filter((_, index) => index % 2 === 0).map(facet => <MenuGroup key={facet.key}
          title={`Theo ${facet.label}`} options={facet.options.filter(option => option.count > 0).map(option => ({
            label: option.label, href: href({ spec: JSON.stringify([facet.key, option.value]) }),
          }))} onNavigate={onNavigate} />)}
      </div>
      <div className={styles.column}>
        {(facets.data?.specs ?? []).filter((_, index) => index % 2 === 1).map(facet => <MenuGroup key={facet.key}
          title={`Theo ${facet.label}`} options={facet.options.filter(option => option.count > 0).map(option => ({
            label: option.label, href: href({ spec: JSON.stringify([facet.key, option.value]) }),
          }))} onNavigate={onNavigate} />)}
        <MenuGroup title="Tình trạng hàng" options={[{ label: "Sản phẩm còn hàng", href: href({ stock_status: "in-stock" }) }]}
          onNavigate={onNavigate} />
      </div>
    </div>
    {facets.loading && <p className={styles.status} role="status">Đang tải lựa chọn theo loại sản phẩm…</p>}
    {facets.error && <p className={styles.status} role="alert">{facets.error} <button type="button" onClick={facets.retry}>Thử lại</button></p>}
    {facets.data?.total === 0 && <p className={styles.status}>Danh mục này chưa có sản phẩm.</p>}
  </section>;
}
