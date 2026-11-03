"use client";

import { useRef } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Button } from "@/components/common/Button";
import { Pagination } from "@/components/common/Pagination";
import { ProductCard } from "@/components/common/ProductCard";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { CatalogDropdownFilters } from "@/components/catalog/CatalogDropdownFilters";
import { catalogHeading } from "@/lib/catalog/filters";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { CatalogStatus } from "@/components/catalog/CatalogStatus";
import { HomePage2Extras } from "./HomePage2Extras";
import { emptyFilters } from "@/components/catalog/catalogData";
import { CatalogFilterChips } from "@/components/catalog/CatalogFilterChips";
import { type CatalogController } from "@/lib/catalog/useCatalog";
import { productHref } from "@/lib/catalog/types";
import styles from "./HomePage2.module.css";
import { AddToCartButton } from "@/components/shopping/AddToCartButton";

export function HomePage2({ catalog }: { catalog: CatalogController }) {
  const { request, products, pagination, loading, error } = catalog;
  const resultsRef = useRef<HTMLDivElement>(null);
  const offset = (request.page - 1) * request.pageSize;
  return <div className={styles.page}>
    <div className={styles.container}>
      <Breadcrumb className={styles.breadcrumb} items={[{ label: "Trang chủ", href: "/" }, { label: "Sản phẩm" }]} />
      <h1>{request.q ? `Kết quả: ${request.q}` : catalogHeading(request.filters, catalog.metadata.data.categories)}{pagination ? ` (${pagination.total} sản phẩm)` : ""}</h1>
      <CatalogDropdownFilters catalog={catalog} />
      <div>
        <CatalogToolbar mobile start={products.length ? offset + 1 : 0} end={products.length ? offset + products.length : 0} total={pagination?.total ?? 0}
          sort={request.sort} pageSize={request.pageSize} view="grid" onSort={catalog.sortBy} onPageSize={catalog.resize} onView={catalog.changeView} />
      </div>
      <div id="homepage2-results" ref={resultsRef} className={styles.results} aria-busy={loading}>
        <CatalogFilterChips filters={request.filters} metadata={catalog.metadata.data} facets={catalog.facets.data} onChange={catalog.apply} />
        <CatalogStatus loading={loading} error={error} retry={catalog.retry} />
        {!loading && !error && (products.length ? <div className={styles.productGrid} aria-label="Sản phẩm">
          {products.map(product => <ProductCard key={product.id} {...product} href={productHref(product.id)} uiLocale="vi" compactOnMobile className={styles.productCard} actions={<AddToCartButton product={product}/>} />)}
        </div> : <div className={styles.noResults}><p>Không tìm thấy sản phẩm phù hợp.</p><Button onClick={() => catalog.apply(emptyFilters)}>Xóa bộ lọc và về trang đầu</Button>{request.q && <Link href="/main/product">Xem tất cả sản phẩm</Link>}</div>)}
      </div>
      {!loading && !error && <div className={styles.pagination}><Pagination currentPage={request.page} totalPages={pagination?.total_pages ?? 0} onPageChange={page => { catalog.turnPage(page); resultsRef.current?.scrollIntoView({ behavior: "instant", block: "start" }); }} /></div>}
      <HomePage2Extras compared={[]} wished={[]} onCompare={() => {}} onWish={() => {}} />
      <p>Tìm theo tên hoặc SKU, lọc theo danh mục và thương hiệu để chọn sản phẩm phù hợp.</p>
    </div>
    <ServiceBenefits />
  </div>;
}
