"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { emptyFilters } from "@/components/catalog/catalogData";
import { CatalogStatus } from "@/components/catalog/CatalogStatus";
import { getProducts } from "@/lib/catalog/client";
import { catalogProduct } from "@/lib/catalog/types";
import { useCatalogMetadata } from "@/lib/catalog/useCatalog";
import { NewProducts, ProductShelf } from "./ProductShelf";
import type { HomeCategory, HomeProduct } from "./homeData";

function useHomeProducts(categoryId = "", pageSize = 8) {
  const [state, setState] = useState<{ key: string; products: HomeProduct[]; error: string | null }>({ key: "", products: [], error: null });
  const [attempt, setAttempt] = useState(0);
  const key = categoryId + ":" + pageSize;
  useEffect(() => {
    const controller = new AbortController();
    getProducts({ q: "", filters: { ...emptyFilters, categories: categoryId ? [categoryId] : [] }, sort: "position", page: 1, pageSize, view: "grid" }, controller.signal)
      .then(result => { if (!controller.signal.aborted) setState({ key, products: result.items.map(catalogProduct), error: null }); })
      .catch(error => { if (!controller.signal.aborted) setState({ key, products: [], error: error instanceof Error ? error.message : "Không thể tải sản phẩm." }); });
    return () => controller.abort();
  }, [categoryId, pageSize, key, attempt]);
  return { ...state, loading: state.key !== key, retry: () => { setState(current => ({ ...current, key: "" })); setAttempt(value => value + 1); } };
}

function CategoryShelf({ category, onSelect }: { category: { id: string; label: string }; onSelect: (product: HomeProduct) => void }) {
  const data = useHomeProducts(category.id, 5);
  const router = useRouter();
  const shelf: HomeCategory = { id: category.id, title: category.label, image: "category-generic.svg", mobileImage: "", groups: [{ label: category.label, products: data.products }] };
  if (data.loading || data.error) return <section aria-label={category.label}><h2>{category.label}</h2><CatalogStatus loading={data.loading} error={data.error} retry={data.retry} /></section>;
  if (!data.products.length) return null;
  return <ProductShelf category={shelf} onSelect={onSelect} onViewAll={() => router.push(`/main/product?${new URLSearchParams({ category_id: category.id })}`)} />;
}

export function HomeFeaturedProducts({ onSelect }: { onSelect: (product: HomeProduct) => void }) {
  const data = useHomeProducts();
  const router = useRouter();
  if (data.loading || data.error) return <CatalogStatus loading={data.loading} error={data.error} retry={data.retry} />;
  if (!data.products.length) return <p>Hiện chưa có sản phẩm đang bán.</p>;
  return <NewProducts products={data.products} onSelect={onSelect} onViewAll={() => router.push("/main/product")} title="Sản phẩm đang bán" />;
}

export function HomeCategoryProducts({ onSelect }: { onSelect: (product: HomeProduct) => void }) {
  const metadata = useCatalogMetadata();
  if (metadata.loading || metadata.error) return <CatalogStatus loading={metadata.loading} error={metadata.error} retry={metadata.retry} />;
  return <>{metadata.data.categories.map(category => <CategoryShelf key={category.id} category={category} onSelect={onSelect} />)}</>;
}
