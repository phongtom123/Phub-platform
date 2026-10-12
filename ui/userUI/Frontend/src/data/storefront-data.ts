export type StoreCategory = { id: string; name: string; description: string; visual: string; accent: string };
export type StoreProduct = {
  id: string; name: string; brand: string; category: string; categoryId: string;
  visual: string; visualDetail: string; price: number; originalPrice?: number;
  rating: number; reviews: number; badge?: string; accent: string;
};
export function formatCurrency(value: number, currency = "VND") {
  return new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", {
    style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(value);
}
