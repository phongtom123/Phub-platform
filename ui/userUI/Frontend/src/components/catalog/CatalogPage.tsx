"use client";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";

import Link from "next/link";
import { useRef, useState } from "react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Button } from "@/components/common/Button";
import { ProductCard } from "@/components/common/ProductCard";
import { ProductListCard } from "@/components/common/ProductListCard";
import { Pagination } from "@/components/common/Pagination";
import { type CatalogController } from "@/lib/catalog/useCatalog";
import { catalogHeading } from "@/lib/catalog/filters";
import { productHref } from "@/lib/catalog/types";
import { CatalogDropdownFilters } from "./CatalogDropdownFilters";
import { CatalogToolbar } from "./CatalogToolbar";
import { CatalogPreview } from "./CatalogPreview";
import { CatalogStatus } from "./CatalogStatus";
import { CatalogFilterChips } from "./CatalogFilterChips";
import { emptyFilters, type CatalogProduct } from "./catalogData";
import styles from "./Catalog.module.css";

export function CatalogPage({ catalog }: { catalog: CatalogController }) {
  const { request, products, pagination, loading, error, metadata } = catalog;
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
    setNotice("Đã cập nhật danh sách tạm trên giao diện. Chức năng tài khoản và đặt hàng chưa được kết nối.");
  }
  return <div className={styles.catalog}>
    <div className={styles.container}>
      <Breadcrumb className={styles.breadcrumb} items={[{ label: "Trang chủ", href: "/" }, { label: "Sản phẩm" }]} />
      <h1>{request.q ? `Kết quả tìm kiếm: ${request.q}` : catalogHeading(filters, metadata.data.categories)}{pagination ? ` (${total} sản phẩm)` : ""}</h1>
      <CatalogDropdownFilters catalog={catalog} />
      <div className={styles.layout}>
        <div className={styles.results} id="catalog-results" ref={resultsRef} tabIndex={-1} aria-busy={loading}>
          <CatalogToolbar start={products.length ? offset + 1 : 0} end={products.length ? offset + products.length : 0} total={total}
            sort={request.sort} pageSize={request.pageSize} view={request.view} onSort={catalog.sortBy} onPageSize={catalog.resize} onView={catalog.changeView} />
          <CatalogFilterChips filters={filters} metadata={metadata.data} facets={catalog.facets.data} onChange={catalog.apply} />
          <CatalogStatus loading={loading} error={error} retry={catalog.retry} />
          {!loading && !error && (products.length ? <div className={ `${styles.productGrid} ${request.view === "list" ? styles.productList : ""}` } aria-label="Catalog products">
            {products.map(product => request.view === "list"
              ? <ProductListCard key={product.id} {...product} href={productHref(product.id)} cartAction={<AddToCartButton product={product} />} compared={compared.some(item => item.id === product.id)} wished={wished.some(item => item.id === product.id)} onCart={() => setNotice("Chưa kết nối API giỏ hàng.")} onCompare={() => toggleSelection("compare", product)} onWish={() => toggleSelection("wish", product)} onEnquire={() => setPreview(product)} />
              : <ProductCard key={product.id} {...product} href={productHref(product.id)} className={styles.productCard} uiLocale="vi" />)}
          </div> : <div className={styles.noResults}><h2>Không tìm thấy sản phẩm</h2><p>Hãy thay đổi điều kiện tìm kiếm hoặc bộ lọc.</p><Button onClick={() => catalog.apply(emptyFilters)}>Xóa bộ lọc và về trang đầu</Button>{request.q && <Link href="/main/product">Xem tất cả sản phẩm</Link>}</div>)}
          {!loading && !error && <div className={styles.pagination}><Pagination currentPage={request.page} totalPages={pagination?.total_pages ?? 0} onPageChange={page => { catalog.turnPage(page); resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); }} /></div>}
          <section className={styles.description} aria-label="Hướng dẫn chọn sản phẩm">
            <div id="catalog-description" className={expanded ? styles.descriptionExpanded : styles.descriptionCollapsed}>
              <p>Khám phá PC nguyên bộ và linh kiện phù hợp với nhu cầu học tập, công việc và giải trí.</p>
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
