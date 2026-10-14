import type { CatalogCategory } from "./types";

export function categoryHref(id: string): string {
  return `/main/product?${new URLSearchParams({ category_id: id })}`;
}

export function rootCategories(categories: CatalogCategory[]): CatalogCategory[] {
  const ids = new Set(categories.map(category => category.id));
  // Category status is independent: an active child of a hidden parent remains reachable.
  return categories.filter(category => category.parentId === null || !ids.has(category.parentId));
}

export function childCategories(categories: CatalogCategory[], parentId: string): CatalogCategory[] {
  return categories.filter(category => category.parentId === parentId && category.id !== parentId);
}
