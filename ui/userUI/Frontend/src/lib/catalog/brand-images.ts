import { resolveProductMediaUrl } from "@/lib/media";

// Add a logo/banner here when an existing brand receives its own artwork.
// Brand identities and navigation still come from /api/catalog/brands.
const images: Record<string, string> = {
  acer: "/brand-logos/acer.svg", amd: "/brand-logos/amd.svg",
  apple: "/brand-logos/apple.svg", asus: "/brand-logos/asus.svg",
  corsair: "/brand-logos/corsair.svg", dell: "/brand-logos/dell.svg",
  hyperx: "/brand-logos/hyperx.svg", intel: "/brand-logos/intel.svg",
  kingston: "/brand-logos/kingstontechnology.svg", lenovo: "/brand-logos/lenovo.svg",
  lg: "/brand-logos/lg.svg", oppo: "/brand-logos/oppo.svg",
  samsung: "/brand-logos/samsung.svg", sony: "/brand-logos/sony.svg",
  xiaomi: "/brand-logos/xiaomi.svg",
  adata: "/images/brands/adata.png", gigabyte: "/images/brands/gigabyte.png",
  hp: "/images/brands/hp.png", "hewlett packard": "/images/brands/hp.png",
  msi: "/images/brands/msi.png", razer: "/images/brands/razer.png",
  roccat: "/images/brands/roccat.png", thermaltake: "/images/brands/thermaltake.png",
  "phub custom": "/images/1.png",
};

export function brandImage(name: string): string | undefined {
  const source = images[name.trim().toLocaleLowerCase("vi")];
  return source ? resolveProductMediaUrl(source) : undefined;
}
