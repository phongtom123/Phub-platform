export function categoryHref(id: string): string {
  return `/main/product?${new URLSearchParams({ category_id: id })}`;
}
