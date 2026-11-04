import { Breadcrumb } from "@/components/common/Breadcrumb";
import type { DetailProduct } from "@/data/product-details";

export function ProductBreadcrumb({ product, className }: { product: DetailProduct; className?: string }) {
  const items = [
    { label: "Trang chủ", href: "/" },
    { label: product.category, href: "/main/product?" + new URLSearchParams({ category_id: product.categoryId }) },
  ];

  if (product.subcategory && product.subcategoryId) {
    items.push({ label: product.subcategory, href: "/main/product?" + new URLSearchParams({ subcategory_id: product.subcategoryId }) });
  }

  return <Breadcrumb className={className} items={[
    ...items,
    ...(product.brand ? [{ label: product.brand }] : []),
    { label: product.name },
  ]} />;
}
