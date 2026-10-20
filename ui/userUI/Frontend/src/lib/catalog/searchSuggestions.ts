import { storeProducts, formatCurrency } from "@/data/storefront-data";
import { catalogProducts } from "@/components/catalog/catalogData";

export interface SearchSuggestion {
  id: string;
  name: string;
  sku: string;
  price: number;
  originalPrice?: number;
  currency: string;
  category?: string;
  brand?: string;
  imageSrc: string;
}

export function removeVietnameseTones(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// Fallback comprehensive products dataset for instant/offline search
const sampleProducts: SearchSuggestion[] = [
  {
    id: "samsung-galaxy-a10",
    name: "Điện thoại Samsung Galaxy A10 32GB Chính hãng",
    sku: "SS-A10-32G",
    price: 2790000,
    originalPrice: 3190000,
    currency: "VND",
    category: "Điện thoại",
    brand: "Samsung",
    imageSrc: "/images/catalog/product-placeholder.svg",
  },
  {
    id: "laptop-asus-tuf-f15",
    name: "Laptop Gaming ASUS TUF Gaming F15 Core i5 / RTX 3050",
    sku: "ASUS-TUF-F15",
    price: 18490000,
    originalPrice: 20990000,
    currency: "VND",
    category: "Laptop",
    brand: "ASUS",
    imageSrc: "/images/home/laptop-stealth.svg",
  },
  {
    id: "laptop-msi-gf63",
    name: "Laptop Gaming MSI Thin GF63 12VE i5 12450H / RTX 4050",
    sku: "MSI-GF63-4050",
    price: 19990000,
    originalPrice: 22490000,
    currency: "VND",
    category: "Laptop",
    brand: "MSI",
    imageSrc: "/images/home/laptop-red.svg",
  },
  {
    id: "samsung-galaxy-s24-ultra",
    name: "Điện thoại Samsung Galaxy S24 Ultra 256GB 5G",
    sku: "SS-S24U-256",
    price: 26990000,
    originalPrice: 29990000,
    currency: "VND",
    category: "Điện thoại",
    brand: "Samsung",
    imageSrc: "/images/catalog/product-placeholder.svg",
  },
  ...storeProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.id.toUpperCase(),
    price: p.price,
    originalPrice: p.originalPrice,
    currency: "VND",
    category: p.category,
    brand: p.brand,
    imageSrc: "/images/catalog/product-placeholder.svg",
  })),
  ...catalogProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.amount,
    currency: p.currency || "VND",
    category: p.categoryName || "Linh kiện & Laptop",
    brand: p.brand,
    imageSrc: p.imageSrc || "/images/catalog/product-placeholder.svg",
  })),
];

// De-duplicate sample products by ID
const uniqueFallbackProducts = Array.from(
  new Map(sampleProducts.map((p) => [p.id, p])).values()
);

export async function fetchSearchSuggestions(
  query: string,
  limit = 6,
  signal?: AbortSignal
): Promise<{ items: SearchSuggestion[]; total: number }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { items: [], total: 0 };
  }

  // 1. Try fetching from live catalog API
  try {
    const params = new URLSearchParams({
      q: trimmed,
      page: "1",
      page_size: String(limit),
    });
    const res = await fetch(`/api/catalog/products?${params.toString()}`, {
      signal,
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        const items: SearchSuggestion[] = data.items.map(
          (item: {
            id: string;
            name: string;
            sku: string;
            price: string | number;
            currency?: string;
            category?: { name?: string };
            brand?: string;
            images?: { url?: string }[];
          }) => ({
            id: String(item.id),
            name: String(item.name),
            sku: String(item.sku),
            price: Number(item.price),
            currency: item.currency || "VND",
            category: item.category?.name,
            brand: item.brand,
            imageSrc: item.images?.[0]?.url || "/images/catalog/product-placeholder.svg",
          })
        );
        return {
          items,
          total: data.pagination?.total ?? items.length,
        };
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    // Fall back to local search if API fails
  }

  // 2. Local fallback search
  const normalizedQuery = removeVietnameseTones(trimmed);
  const lowerQuery = trimmed.toLowerCase();

  const matches = uniqueFallbackProducts.filter((p) => {
    const pName = p.name.toLowerCase();
    const pSku = p.sku.toLowerCase();
    const pBrand = (p.brand || "").toLowerCase();
    const pCat = (p.category || "").toLowerCase();

    // Direct match
    if (
      pName.includes(lowerQuery) ||
      pSku.includes(lowerQuery) ||
      pBrand.includes(lowerQuery) ||
      pCat.includes(lowerQuery)
    ) {
      return true;
    }

    // Accent-free match
    const normName = removeVietnameseTones(p.name);
    const normSku = removeVietnameseTones(p.sku);
    const normBrand = removeVietnameseTones(p.brand || "");
    const normCat = removeVietnameseTones(p.category || "");

    return (
      normName.includes(normalizedQuery) ||
      normSku.includes(normalizedQuery) ||
      normBrand.includes(normalizedQuery) ||
      normCat.includes(normalizedQuery)
    );
  });

  // Sort: products with name starting with query or closer match first
  matches.sort((a, b) => {
    const aNorm = removeVietnameseTones(a.name);
    const bNorm = removeVietnameseTones(b.name);
    const aStarts = aNorm.startsWith(normalizedQuery);
    const bStarts = bNorm.startsWith(normalizedQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return 0;
  });

  return {
    items: matches.slice(0, limit),
    total: matches.length,
  };
}

export function formatPriceDisplay(amount: number, currency = "VND"): string {
  return formatCurrency(amount, currency);
}
