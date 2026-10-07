"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Button } from "@/components/common/Button";
import { ProductCard } from "@/components/common/ProductCard";
import { ProductListCard } from "@/components/common/ProductListCard";
import { Pagination } from "@/components/common/Pagination";
import { useCatalogDraft, type CatalogController } from "@/lib/catalog/useCatalog";
import { productHref } from "@/lib/catalog/types";
import { CatalogSidebar } from "./CatalogSidebar";
import { CatalogToolbar } from "./CatalogToolbar";
import { CatalogPreview } from "./CatalogPreview";
import { CatalogStatus } from "./CatalogStatus";
import { emptyFilters, type CatalogProduct } from "./catalogData";
import styles from "./Catalog.module.css";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";

export function CatalogPage({ catalog }: { catalog: CatalogController }) {
  const { request, products, pagination, loading, error, metadata } = catalog;
  const [draft, setDraft] = useCatalogDraft(catalog);
  const shop = useShopping();
  const [compared, setCompared] = useState<CatalogProduct[]>([]);
  const [wished, setWished] = useState<CatalogProduct[]>([]);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<CatalogProduct | null>(null);
  const [expanded, setExpanded] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const filters = request.filters;
  const total = pagination?.total ?? 0;
  const offset = (request.page - 1) * request.pageSize;
  function toggleSelection(kind: "compare" | "wish", product: CatalogProduct) {
    const values = kind === "compare" ? compared : wished;
    const setValues = kind === "compare" ? setCompared : setWished;
    setValues(values.some(item => item.id === product.id) ? values.filter(item => item.id !== product.id) : [...values, product]);
    setNotice("Đã cập nhật danh sách so sánh hoặc yêu thích tạm trên giao diện.");
  }
  const chips = [
    ...filters.categories.map(id => ({ key: id, label: metadata.data.categories.find(option => option.id === id)?.label ?? id, next: { ...filters, categories: filters.categories.filter(value => value !== id) } })),
    ...(filters.brand ? [{ key: "brand", label: filters.brand, next: { ...filters, brand: "" } }] : []),
    ...(filters.minPrice || filters.maxPrice ? [{ key: "price", label: `${filters.minPrice || "0"} – ${filters.maxPrice || "không giới hạn"} ₫`, next: { ...filters, minPrice: "", maxPrice: "" } }] : []),
    ...(filters.color ? [{ key: "color", label: metadata.data.colors.find(option => option.value === filters.color)?.label || filters.color, next: { ...filters, color: "" } }] : []),
    ...(filters.stockStatus ? [{ key: "stock", label: filters.stockStatus === "in-stock" ? "Còn hàng" : "Hết hàng", next: { ...filters, stockStatus: "" as const } }] : []),
  ];
  return <div className={styles.catalog}>
    <div className={styles.container}>
      <a className={styles.banner} href="#catalog-results" aria-label="Khám phá sản phẩm"><Image src="/images/home/banner-asus.png" alt="ASUS TUF Gaming" width={1398} height={104} sizes="(max-width: 1438px) 100vw, 1398px" priority /></a>
      <Breadcrumb className={styles.breadcrumb} items={[{ label: "Trang chủ", href: "/" }, { label: "Sản phẩm" }]} />
      <h1>{request.q ? `Kết quả tìm kiếm: ${request.q}` : "Sản phẩm"}{pagination ? ` (${total})` : ""}</h1>
      <div className={styles.layout}>
        <div className={styles.sidebarColumn}>
          <Link className={styles.back} href="/">‹ Trang chủ</Link>
          <aside id="catalog-sidebar" className={styles.sidebar} aria-label="Bộ lọc sản phẩm">
            <CatalogSidebar draft={draft} onChange={setDraft} onApply={() => catalog.apply(draft)} onClear={() => catalog.apply(emptyFilters)}
              activeBrand={filters.brand} onBrand={brand => catalog.apply({ ...filters, brand })}
              compared={compared} wished={wished} onCompare={product => toggleSelection("compare", product)} onWish={product => toggleSelection("wish", product)} onSelect={setPreview}
              metadata={metadata} locale="vi" />
          </aside>
        </div>
        <div className={styles.results} id="catalog-results" ref={resultsRef} tabIndex={-1} aria-busy={loading}>
          <CatalogToolbar start={products.length ? offset + 1 : 0} end={products.length ? offset + products.length : 0} total={total}
            sort={request.sort} pageSize={request.pageSize} view={request.view} onSort={catalog.sortBy} onPageSize={catalog.resize} onView={catalog.changeView} />
          <div className={styles.chips} aria-label="Bộ lọc đang áp dụng">
            {chips.map(chip => <button key={chip.key} onClick={() => catalog.apply(chip.next)} aria-label={ `Xóa bộ lọc ${chip.label}` }>{chip.label}<span aria-hidden="true">×</span></button>)}
            {chips.length > 0 && <button onClick={() => catalog.apply(emptyFilters)}>Xóa bộ lọc</button>}
          </div>
          <CatalogStatus loading={loading} error={error} retry={catalog.retry} />
          {!loading && !error && (products.length ? <div className={ `${styles.productGrid} ${request.view === "list" ? styles.productList : ""}` } aria-label="Catalog products">
            {products.map(product => request.view === "list"
              ? <ProductListCard key={product.id} {...product} inCart={shop.lines.some(item => item.sku === product.sku)} compared={compared.some(item => item.id === product.id)} wished={wished.some(item => item.id === product.id)} onSelect={() => setPreview(product)} onCart={() => void shop.add(product)} onCompare={() => toggleSelection("compare", product)} onWish={() => toggleSelection("wish", product)} onEnquire={() => setPreview(product)} />
              : <ProductCard key={product.id} {...product} href={productHref(product.id)} className={styles.productCard} onSelect={() => setPreview(product)} uiLocale="vi" actions={<AddToCartButton product={product}/>} />)}
          </div> : <div className={styles.noResults}><h2>Không tìm thấy sản phẩm</h2><p>Hãy thay đổi điều kiện tìm kiếm hoặc bộ lọc.</p><Button onClick={() => catalog.apply(emptyFilters)}>Xóa bộ lọc và về trang đầu</Button>{request.q && <Link href="/main/product">Xem tất cả sản phẩm</Link>}</div>)}
          {!loading && !error && <div className={styles.pagination}><Pagination currentPage={request.page} totalPages={pagination?.total_pages ?? 0} onPageChange={page => { catalog.turnPage(page); resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); }} /></div>}
          <section className={styles.description} aria-label="Hướng dẫn chọn sản phẩm">
            <div id="catalog-description" className={expanded ? styles.descriptionExpanded : styles.descriptionCollapsed}>
              <p>Khám phá máy tính, laptop và thiết bị phù hợp với nhu cầu học tập, công việc và giải trí.</p>
              <p>Tìm theo tên hoặc SKU, chọn loại sản phẩm và thương hiệu, hoặc sắp xếp theo giá để dễ dàng lựa chọn.</p>
              <p>Mở chi tiết sản phẩm để xem mô tả, thời gian bảo hành và thông số kỹ thuật hiện có.</p>
            </div>
            <Button variant="outline" aria-expanded={expanded} aria-controls="catalog-description" onClick={() => setExpanded(!expanded)}>{expanded ? "Thu gọn" : "Xem thêm"}</Button>
          </section>
        </div>
      </div>
    </div>
    {preview && <CatalogPreview product={preview} onClose={() => setPreview(null)} locale="vi" />}
    <div role="status" aria-live="polite" className={notice ? styles.actionNotice : styles.srOnly}>{notice && <><span>{notice}</span><button aria-label="Đóng thông báo" onClick={() => setNotice("")}>×</button></>}</div>
  </div>;
}
