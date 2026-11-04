import { CatalogApiError, readJson } from "./client";

export type CatalogBanner = {
  id: number; title: string; image_url: string; alt_text: string;
  width: number | null; height: number | null;
};

export async function getBanners(signal: AbortSignal): Promise<CatalogBanner[]> {
  const body = await readJson(await fetch("/api/catalog/banners", { signal, cache: "no-store" })) as { items?: unknown };
  if (!Array.isArray(body?.items) || body.items.some((item: CatalogBanner) => {
    if (!item || !Number.isSafeInteger(item.id) || typeof item.title !== "string" || typeof item.alt_text !== "string" || typeof item.image_url !== "string") return true;
    try { const url = new URL(item.image_url); return !["https:", "http:"].includes(url.protocol) || Boolean(url.username || url.password); }
    catch { return true; }
  }) || new Set(body.items.map((item: CatalogBanner) => item.id)).size !== body.items.length) {
    throw new CatalogApiError("Không đọc được banner quảng cáo.", 502);
  }
  return body.items;
}
