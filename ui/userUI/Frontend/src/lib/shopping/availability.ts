import { readJson } from "@/lib/catalog/client";

export const MAX_QUANTITY = 2147483647;
export async function getAvailability(skus: string[], signal?: AbortSignal) {
  const params = new URLSearchParams();
  [...new Set(skus)].sort().forEach(sku => params.append("sku", sku));
  const value = await readJson(await fetch(`/api/catalog/availability?${params}`, { cache: "no-store", signal }));
  const data = value as { items?: { sku: string; available_quantity: number }[]; tax_rate?: string; currency?: string };
  if (!Array.isArray(data.items) || data.tax_rate !== "10.00" || data.currency !== "VND") throw new Error("Chưa xác nhận được tồn kho và thuế.");
  const quantities: Record<string, number> = Object.create(null);
  for (const item of data.items) {
    if (!skus.includes(item.sku) || Object.hasOwn(quantities, item.sku) || !Number.isInteger(item.available_quantity) || item.available_quantity < 0 || item.available_quantity > MAX_QUANTITY) throw new Error("Tồn kho không hợp lệ.");
    quantities[item.sku] = item.available_quantity;
  }
  // Missing public SKUs are no longer available for purchase.
  for (const sku of skus) if (!Object.hasOwn(quantities, sku)) quantities[sku] = 0;
  return { quantities, taxRate: data.tax_rate };
}
