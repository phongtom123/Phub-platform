"use client";

import { useRef, useState } from "react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Button } from "@/components/common/Button";
import { Pagination } from "@/components/common/Pagination";
import { ProductCard } from "@/components/common/ProductCard";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { MobileFilterPanel } from "@/components/mobile/filter/MobileFilterPanel";
import { CatalogToolbar } from "@/components/catalog/CatalogToolbar";
import { HomePage2Description } from "./HomePage2Description";
import { HomePage2Extras } from "./HomePage2Extras";
import { emptyFilters, initialFilters, selectProducts, type CatalogFilters, type CatalogSort } from "@/components/catalog/catalogData";
import { homePage2Products } from "./homePage2Data";
import styles from "./HomePage2.module.css";

interface Props { categoryLabel?: string; itemLabel?: string }
const pageSize = 12;

export function HomePage2({ categoryLabel, itemLabel }: Props) {
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [draft, setDraft] = useState<CatalogFilters>(initialFilters);
  const [sort, setSort] = useState<CatalogSort>("position");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLDivElement>(null);
  const results = selectProducts(filters, sort).map(product => homePage2Products[product.position]);
  const totalPages = Math.ceil(results.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const offset = (currentPage - 1) * pageSize;
  const visible = results.slice(offset, offset + pageSize);
  const title = itemLabel ?? "MSI PS Series";
  const breadcrumbs = itemLabel && categoryLabel
    ? [{ label: "Trang chủ", href: "/" }, { label: categoryLabel, href: "/main/product" }, { label: itemLabel }]
    : [{ label: "Trang chủ", href: "/" }, { label: "Laptop", href: "/main/product" }, { label: "Laptop dùng hằng ngày" }, { label: "MSI Prestige Series" }, { label: "MSI WS Series" }];

  function apply(next: CatalogFilters) {
    setFilters(next);
    setDraft(next);
    setPage(1);
    setFiltersOpen(false);
    filterButtonRef.current?.querySelector("button")?.focus();
  }

  function toggleFilters() {
    if (!filtersOpen) setDraft(filters);
    setFiltersOpen(value => !value);
  }

  function closeFilters() {
    setDraft(filters);
    setFiltersOpen(false);
    filterButtonRef.current?.querySelector("button")?.focus();
  }

  function turnPage(next: number) {
    setPage(next);
    resultsRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  return <div className={styles.page}>
    <div className={styles.container}>
      <Breadcrumb className={styles.breadcrumb} items={breadcrumbs} />
      <h1>{title} ({results.length})</h1>
      <div ref={filterButtonRef}>
        <CatalogToolbar mobile start={results.length ? offset + 1 : 0} end={offset + visible.length} total={results.length} sort={sort} pageSize={pageSize} view="grid" onSort={next => { setSort(next); setPage(1); }} onPageSize={() => {}} onView={() => {}} filtersOpen={filtersOpen} onFilter={toggleFilters} />
      </div>
      <div id="homepage2-results" ref={resultsRef} className={styles.results}>
        {visible.length ? <div className={styles.productGrid} aria-label="Sản phẩm">
          {visible.map(product => <ProductCard key={product.id} {...product} href={`/main/product/${product.id}`} imageSrc={product.mobileImageSrc} uiLocale="vi" compactOnMobile className={styles.productCard} />)}
        </div> : <div className={styles.noResults}><p>Không tìm thấy sản phẩm phù hợp.</p><Button onClick={() => apply(emptyFilters)}>Xóa bộ lọc</Button></div>}
      </div>
      <div className={styles.pagination}><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={turnPage} /></div>
      <HomePage2Extras compared={[]} wished={[]} onCompare={() => {}} onWish={() => {}} />
      <HomePage2Description />
    </div>
    <ServiceBenefits />
    <MobileFilterPanel open={filtersOpen} draft={draft} onChange={setDraft} onApply={() => apply(draft)} onClose={closeFilters} />
  </div>;
}
