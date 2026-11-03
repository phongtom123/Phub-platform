import type { ApiProduct, ApiProductPage, CatalogCategory, CatalogMetadata, CatalogRequest } from "./types";

export class CatalogApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function readJson(response: Response): Promise<unknown> {
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new CatalogApiError("Không thể đọc dữ liệu sản phẩm. Vui lòng thử lại.", 502); }
  if (!response.ok) {
    // Only show the API's public, normalized error envelope.
    const error = data as { error?: { message?: unknown } };
    const message = typeof error?.error?.message === "string"
      ? error.error.message : "Không thể tải dữ liệu sản phẩm. Vui lòng thử lại.";
    throw new CatalogApiError(message, response.status);
  }
  return data;
}

export function validateProduct(value: unknown): ApiProduct {
  const product = value as ApiProduct;
  if (!product || typeof product.id !== "string" || typeof product.sku !== "string"
    || typeof product.name !== "string" || typeof product.category?.id !== "string"
    || (product.is_active !== undefined && typeof product.is_active !== "boolean")
    || typeof product.category?.name !== "string" || typeof product.price !== "string"
    || typeof product.subcategory?.id !== "string" || typeof product.subcategory?.name !== "string"
    || !/^\d+(\.\d{1,2})?$/.test(product.price) || !Number.isFinite(Number(product.price))
    || !/^[A-Z]{3}$/.test(product.currency ?? "")
    || !(product.brand === null || typeof product.brand === "string")
    || !(product.description === null || typeof product.description === "string")
    || typeof product.unit !== "string" || !Number.isInteger(product.warranty_months) || product.warranty_months < 0
    || !Array.isArray(product.images) || !product.images.every(image => image && typeof image.url === "string" && typeof image.alt === "string")
    || !Array.isArray(product.specifications) || !product.specifications.every(spec => spec && typeof spec.label === "string" && typeof spec.value === "string")) {
    throw new CatalogApiError("Dữ liệu sản phẩm không hợp lệ. Vui lòng thử lại.", 502);
  }
  return product;
}

export async function getProductPurchaseState(product: { id: string; sku?: string }, quantity: number, signal?: AbortSignal) {
  const result = await readJson(await fetch(
    `/api/catalog/products/${encodeURIComponent(product.id)}/availability?quantity=${quantity}`,
    { cache: "no-store", signal },
  )) as { id?: unknown; sku?: unknown; quantity?: unknown; available?: unknown; is_active?: unknown } | null;
  if (!result || result.id !== product.id || typeof result.sku !== "string" || !result.sku
      || (product.sku !== undefined && result.sku !== product.sku) || result.quantity !== quantity || typeof result.available !== "boolean"
      || (result.is_active !== undefined && typeof result.is_active !== "boolean")) {
    throw new CatalogApiError("Không kiểm tra được tồn kho. Vui lòng thử lại.", 502);
  }
  return { available: result.available && result.is_active !== false, isActive: result.is_active !== false };
}

export async function getProductAvailability(product: { id: string; sku?: string }, quantity: number, signal?: AbortSignal): Promise<boolean> {
  return (await getProductPurchaseState(product, quantity, signal)).available;
}

export function queryFor(request: CatalogRequest): URLSearchParams {
  const params = new URLSearchParams();
  params.set("include_inactive", "true");
  if (request.q.trim()) params.set("q", request.q.trim());
  request.filters.categories.forEach(id => params.append("category_id", id));
  request.filters.subcategories.forEach(id => params.append("subcategory_id", id));
  if (request.filters.brand) params.set("brand", request.filters.brand);
  if (request.filters.minPrice?.trim()) params.set("min_price", request.filters.minPrice.trim());
  if (request.filters.maxPrice?.trim()) params.set("max_price", request.filters.maxPrice.trim());
  if (request.filters.color) params.set("color", request.filters.color);
  const stockStatus = request.filters.stockStatus || (request.filters.inStock ? "in-stock" : "");
  if (stockStatus) params.set("stock_status", stockStatus);
  Object.entries(request.filters.specs ?? {}).sort(([a], [b]) => a.localeCompare(b)).forEach(([key, values]) => {
    [...new Set(values)].sort().forEach(value => params.append("spec", JSON.stringify([key, value])));
  });
  params.set("sort", request.sort === "position" ? "default" : request.sort);
  params.set("page", String(request.page));
  params.set("page_size", String(request.pageSize));
  return params;
}

export async function getProducts(request: CatalogRequest, signal?: AbortSignal): Promise<ApiProductPage> {
  const data = await readJson(await fetch(`/api/catalog/products?${queryFor(request)}`, { signal })) as ApiProductPage;
  if (!Array.isArray(data?.items) || !data.pagination
    || ![data.pagination.page, data.pagination.page_size, data.pagination.total, data.pagination.total_pages].every(Number.isInteger)
    || data.pagination.page < 1 || data.pagination.page_size < 1 || data.pagination.total < 0 || data.pagination.total_pages < 0) {
    throw new CatalogApiError("Dữ liệu phân trang không hợp lệ. Vui lòng thử lại.", 502);
  }
  return { ...data, items: data.items.map(validateProduct) };
}

export async function getCategories(signal?: AbortSignal): Promise<CatalogCategory[]> {
  const categories = await readJson(await fetch("/api/catalog/categories", { signal })) as {
    items: { id: string; name: string; children: { id: string; name: string }[] }[];
  };
  if (!Array.isArray(categories?.items) || !categories.items.every(item => item && typeof item.id === "string"
    && typeof item.name === "string" && Array.isArray(item.children)
    && item.children.every(child => child && typeof child.id === "string" && typeof child.name === "string"))) {
    throw new CatalogApiError("Không thể đọc danh mục sản phẩm.", 502);
  }
  return categories.items.map(item => ({
    id: item.id, label: item.name,
    children: item.children.map(child => ({ id: child.id, label: child.name })),
  }));
}

export async function getMetadata(signal?: AbortSignal): Promise<CatalogMetadata> {
  const [categories, brands] = await Promise.all([
    getCategories(signal),
    fetch("/api/catalog/brands", { signal }).then(readJson),
  ]) as [CatalogCategory[], { items: { name: string }[] }];
  if (!Array.isArray(brands?.items) || !brands.items.every(item => item && typeof item.name === "string")) {
    throw new CatalogApiError("Không thể đọc danh mục và thương hiệu.", 502);
  }
  return {
    categories,
    brands: brands.items.map(item => ({ id: item.name, name: item.name })),
  };
}
