"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Button } from "@/components/common/Button";
import { ProductCard } from "@/components/common/ProductCard";
import { ProductListCard } from "@/components/common/ProductListCard";
import { Pagination } from "@/components/common/Pagination";
import { CatalogSidebar } from "./CatalogSidebar";
import { CatalogToolbar } from "./CatalogToolbar";
import { CatalogPreview } from "./CatalogPreview";
import { catalogBrands, catalogProducts, categoryOptions, emptyFilters, filterCount, initialFilters, priceOptions, selectProducts, type CatalogFilters, type CatalogProduct, type CatalogSort } from "./catalogData";
import styles from "./Catalog.module.css";

export function CatalogPage({ initialView = "grid" }: { initialView?: "grid" | "list" }) {
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [draft, setDraft] = useState<CatalogFilters>(initialFilters);
  const [sort, setSort] = useState<CatalogSort>("position");
  const [pageSizes, setPageSizes] = useState({ grid: 20, list: 4 });
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "list">(initialView);
  const [cart, setCart] = useState<string[]>([]);
  const [compared, setCompared] = useState<string[]>([]);
  const [wished, setWished] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<CatalogProduct | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const mobileToggle = useRef<HTMLButtonElement>(null);
  const results = selectProducts(filters, sort);
  const pageSize = pageSizes[view];
  const totalPages = Math.ceil(results.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const offset = (currentPage - 1) * pageSize;
  const visible = results.slice(offset, offset + pageSize);
  function apply(next: CatalogFilters) {
    setFilters(next); setDraft(next); setPage(1);
    if (mobileFilters) { setMobileFilters(false); mobileToggle.current?.focus(); }
  }
  function toggleSelection(kind: "cart" | "compare" | "wish", product: CatalogProduct) {
    const values = kind === "cart" ? cart : kind === "compare" ? compared : wished;
    const setValues = kind === "cart" ? setCart : kind === "compare" ? setCompared : setWished;
    const exists = values.includes(product.id);
    setValues(exists ? values.filter(id => id !== product.id) : [...values, product.id]);
    const label = kind === "cart" ? "demo cart" : kind === "compare" ? "comparison list" : "wish list";
    setNotice(`${product.sku} ${exists ? "removed from" : "added to"} ${label}. UI preview only — no order or account data is saved.`);
  }
  const chips = [
    ...filters.categories.map(id => ({ key: id, label: categoryOptions.find(option => option.id === id)?.label ?? id, next: { ...filters, categories: filters.categories.filter(value => value !== id) } })),
    ...(filters.price ? [{ key: "price", label: priceOptions.find(option => option.id === filters.price)?.label ?? "Price", next: { ...filters, price: "" } }] : []),
    ...(filters.color ? [{ key: "color", label: `Color: ${filters.color}`, next: { ...filters, color: "" } }] : []),
    ...(filters.brand ? [{ key: "brand", label: catalogBrands.find(brand => brand.id === filters.brand)?.name ?? filters.brand, next: { ...filters, brand: "" } }] : []),
    ...(filters.inStock ? [{ key: "stock", label: "In stock", next: { ...filters, inStock: false } }] : []),
  ];
  return <div className={styles.catalog}>
    <div className={styles.container}>
      <a className={styles.banner} href="#catalog-results" aria-label="ASUS TUF gaming promotion — browse the sample catalog"><Image src="/images/home/banner-asus.png" alt="ASUS TUF Gaming FX505 — High performance at an affordable price" width={1398} height={104} sizes="(max-width: 1438px) 100vw, 1398px" priority /></a>
      <Breadcrumb className={styles.breadcrumb} items={[{ label: "Home", href: "/" }, { label: "Laptops", href: "/main/product" }, { label: "Everyday Use Notebooks" }, { label: "MSI Prestige Series" }, { label: "MSI WS Series" }]} />
      <h1>MSI PS Series ({results.length})</h1>
      <div className={styles.layout}>
        <div className={styles.sidebarColumn}>
          <Link className={styles.back} href="/">‹ Back</Link>
          <button ref={mobileToggle} type="button" className={styles.mobileFilterButton} onClick={() => setMobileFilters(!mobileFilters)} aria-expanded={mobileFilters} aria-controls="catalog-sidebar">{mobileFilters ? "Hide filters" : `Filters (${filterCount(filters)})`}</button>
          <aside id="catalog-sidebar" className={`${styles.sidebar} ${mobileFilters ? styles.sidebarOpen : ""}`} aria-label="Catalog filters and brands">
            <CatalogSidebar draft={draft} onChange={setDraft} onApply={() => apply(draft)} onClear={() => apply(emptyFilters)} activeBrand={filters.brand} onBrand={brand => apply({ ...filters, brand })} compared={catalogProducts.filter(product => compared.includes(product.id))} wished={catalogProducts.filter(product => wished.includes(product.id))} onCompare={product => toggleSelection("compare", product)} onWish={product => toggleSelection("wish", product)} onSelect={setPreview} />
          </aside>
        </div>
        <div className={styles.results} id="catalog-results" ref={resultsRef} tabIndex={-1}>
          <CatalogToolbar start={results.length ? offset + 1 : 0} end={offset + visible.length} total={results.length} sort={sort} pageSize={pageSize} view={view} onSort={value => { setSort(value); setPage(1); }} onPageSize={value => { setPageSizes({ ...pageSizes, [view]: value }); setPage(1); }} onView={value => { if (value !== view) { setView(value); setPage(1); } }} />
          <div className={styles.chips} aria-label="Active filters">
            {chips.map(chip => <button key={chip.key} onClick={() => apply(chip.next)} aria-label={`Remove ${chip.label} filter`}>{chip.label}<span aria-hidden="true">×</span></button>)}
            {chips.length > 0 && <button onClick={() => apply(emptyFilters)}>Clear All</button>}
          </div>
          {visible.length > 0 ? <div className={`${styles.productGrid} ${view === "list" ? styles.productList : ""}`} aria-label="Catalog products">
            {visible.map(product => view === "list"
              ? <ProductListCard key={product.id} {...product} inCart={cart.includes(product.id)} compared={compared.includes(product.id)} wished={wished.includes(product.id)} onSelect={() => setPreview(product)} onCart={() => toggleSelection("cart", product)} onCompare={() => toggleSelection("compare", product)} onWish={() => toggleSelection("wish", product)} onEnquire={() => { setPreview(product); setNotice("Product enquiry preview opened. No email or message has been sent."); }} />
              : <ProductCard key={product.id} {...product} href="#catalog-results" className={styles.productCard} onSelect={() => setPreview(product)} />)}
          </div> : <div className={styles.noResults}><h2>No products found</h2><p>Try removing a filter or viewing all sample products.</p><Button onClick={() => apply(emptyFilters)}>Reset filters</Button></div>}
          <div className={styles.pagination}><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={next => { setPage(next); resultsRef.current?.focus({ preventScroll: true }); resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); }} /></div>
          <section className={styles.description} aria-label="About MSI Prestige">
            <div id="catalog-description" className={expanded ? styles.descriptionExpanded : styles.descriptionCollapsed}>
              <p>MSI has unveiled the Prestige Series line of business-class and gaming notebooks. Tuned for color accuracy, the Prestige Series offers a versatile workspace for everyday creativity.</p>
              <p>Explore notebooks for work, study and entertainment. Compare designs, choose your preferred configuration, and find a setup that suits the way you use your computer.</p>
              <p>A lightweight design makes it easy to move between your desk and your next destination. Browse the collection using the filters above to discover more options.</p>
              <p>This catalog is a UI demonstration. Product names, prices, availability, category tags and color filters are illustrative; the photographs do not verify the listed configuration. No ordering or payment service is connected.</p>
            </div>
            <Button variant="outline" aria-expanded={expanded} aria-controls="catalog-description" onClick={() => setExpanded(!expanded)}>{expanded ? "Less" : "More"}</Button>
          </section>
        </div>
      </div>
    </div>
    {preview && <CatalogPreview product={preview} onClose={() => setPreview(null)} />}
    <div role="status" aria-live="polite" className={notice ? styles.actionNotice : styles.srOnly}>{notice && <><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}>×</button></>}</div>
  </div>;
}
