export function categoryHref(id: string, childId?: string): string {
  return `/main/product?${new URLSearchParams(childId
    ? { subcategory_id: childId }
    : { category_id: id })}`;
}
