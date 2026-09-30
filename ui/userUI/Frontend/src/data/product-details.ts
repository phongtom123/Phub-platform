import { catalogProducts } from "@/components/catalog/catalogData";
import { homePage2Products } from "@/components/mobile/home-page-2/homePage2Data";
import { categories, newProducts, type HomeProduct } from "@/components/home/homeData";
import { storeProducts, type StoreProduct } from "./storefront-data";

export interface DetailProduct extends StoreProduct {
  imageSrc?: string;
  mobileImageSrc?: string;
  currency: "USD" | "VND";
  sku: string;
  stock: "in-stock" | "check-availability";
  specifications: { label: string; value: string }[];
}

const defaultSpecs = [{ label: "CPU", value: "N/A" }, { label: "Featured", value: "N/A" }, { label: "I/O Ports", value: "N/A" }];
function fromCurrent(product: HomeProduct, category = "Tech Store"): DetailProduct {
  return {
    id: product.id, name: product.name, brand: "Tech Store", category, categoryId: "current",
    imageSrc: product.imageSrc, mobileImageSrc: product.mobileImageSrc, price: product.amount, originalPrice: product.originalAmount,
    rating: product.rating ?? 0, reviews: product.reviewCount ?? 0, currency: "USD",
    visual: "", visualDetail: "", accent: "#0156ff", sku: product.id.toUpperCase(),
    stock: product.stock ?? "in-stock", specifications: defaultSpecs,
  };
}

// The outside Frontend remains authoritative. The old collection is only a
// fallback for existing deep links, and never replaces Home/Catalog fixtures.
const currentProducts: DetailProduct[] = [
  ...catalogProducts.map(product => {
    const mobile = homePage2Products[product.position];
    return { ...fromCurrent({ ...product, name: mobile.name, mobileImageSrc: mobile.mobileImageSrc }, "MSI Prestige Series"), brand: "MSI", categoryId: "catalog", sku: product.sku, specifications: product.specifications };
  }),
  ...newProducts.map(product => product.id === "trident-pc" ? { ...fromCurrent(product), sku: "D55I5AI" } : fromCurrent(product)),
  ...categories.flatMap(category => category.groups.flatMap(group => group.products.map(product => fromCurrent(product, category.title)))),
];
const legacyProducts: DetailProduct[] = storeProducts.map(product => ({
  ...product, currency: "VND", sku: product.id.toUpperCase(), stock: "in-stock", specifications: defaultSpecs,
}));
const detailProducts = [...new Map([...currentProducts, ...legacyProducts].map(product => [product.id, product])).values()];

export function getDetailProduct(id: string) {
  return detailProducts.find(product => product.id === id);
}
export function getRelatedProducts(product: DetailProduct) {
  return detailProducts.filter(item => item.id !== product.id && item.currency === product.currency && item.categoryId === product.categoryId).slice(0, 4);
}
