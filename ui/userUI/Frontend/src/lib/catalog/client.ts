import type { ApiProduct, ApiProductPage, CatalogMetadata, CatalogRequest } from "./types";

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
    || typeof product.category?.name !== "string" || typeof product.price !== "string"
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

export function queryFor(request: CatalogRequest): URLSearchParams {
  const params = new URLSearchParams();
  if (request.q.trim()) params.set("q", request.q.trim());
  request.filters.categories.forEach(id => params.append("category_id", id));
  if (request.filters.brand) params.set("brand", request.filters.brand);
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

export async function getMetadata(signal?: AbortSignal): Promise<CatalogMetadata> {
  const [categories, brands] = await Promise.all([
    fetch("/api/catalog/categories", { signal }).then(readJson),
    fetch("/api/catalog/brands", { signal }).then(readJson),
  ]) as [{ items: { id: string; name: string }[] }, { items: { name: string }[] }];
  if (!Array.isArray(categories?.items) || !categories.items.every(item => item && typeof item.id === "string" && typeof item.name === "string")
    || !Array.isArray(brands?.items) || !brands.items.every(item => item && typeof item.name === "string")) {
    throw new CatalogApiError("Không thể đọc danh mục và thương hiệu.", 502);
  }
  return {
    categories: categories.items.map(item => ({ id: item.id, label: item.name })),
    brands: brands.items.map(item => ({ id: item.name, name: item.name })),
  };
}
