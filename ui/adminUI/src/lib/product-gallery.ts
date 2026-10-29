import { adminFetch } from "./admin-fetch";

export type GalleryImage = { media_id: string; url: string; alt_text: string | null; position: number; primary: boolean };
export type ProductGallery = { product_id: string; legacy_url: string | null; images: GalleryImage[] };
export type GallerySource = { media_id: string } | { url: string };
export const MAX_PRODUCT_IMAGES = 20;

export function validateGalleryFiles(files: File[], currentCount: number): void {
  if (files.length + currentCount > MAX_PRODUCT_IMAGES) throw new Error(`Mỗi sản phẩm tối đa ${MAX_PRODUCT_IMAGES} ảnh.`);
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error(`${file.name}: chỉ hỗ trợ JPG, PNG hoặc WebP.`);
    if (!file.size || file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: dung lượng phải từ 1 byte đến 5 MB.`);
  }
}

export function moveGalleryImage<T>(images: readonly T[], from: number, to: number): T[] {
  const next = [...images];
  if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [image] = next.splice(from, 1); next.splice(to, 0, image);
  return next;
}

export async function galleryRequest(productId: string, signal: AbortSignal, update?: { items: GallerySource[]; base: ProductGallery }): Promise<ProductGallery> {
  const response = await adminFetch(`/api/backend/admin/media/products/${encodeURIComponent(productId)}/images`, {
    signal, cache: "no-cache", ...(update ? {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: update.items, expected_ids: update.base.images.map(image => image.media_id), expected_legacy_url: update.base.legacy_url }),
    } : {}),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(response.status === 404 ? "Không tải được gallery. Kiểm tra sản phẩm và deploy backend có API nhiều ảnh."
      : typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((item: { msg: string }) => item.msg).join("; ") : "Không lưu được gallery.");
  }
  if (body?.product_id !== productId || !Array.isArray(body.images) || !body.images.every((image: GalleryImage) => typeof image.media_id === "string" && typeof image.url === "string")) {
    throw new Error("API trả gallery không hợp lệ.");
  }
  return body;
}
