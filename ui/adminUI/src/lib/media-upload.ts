import { adminFetch } from "./admin-fetch";

export async function uploadMediaImage(file: File, signal?: AbortSignal, purpose: "product" | "promotion_banner" = "product"): Promise<{ media_id: string; url: string }> {
  const response = await adminFetch("/api/backend/admin/media/images" + (purpose === "promotion_banner" ? "?purpose=promotion_banner" : ""), {
    method: "POST", headers: { "Content-Type": file.type }, body: file, signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404) throw new Error("Backend chưa có API upload ảnh. Cần deploy backend mới trước khi tải ảnh.");
    throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được ảnh lên Storage.");
  }
  if (typeof body?.media_id !== "string" || typeof body?.url !== "string" || !/^https?:\/\//.test(body.url)) throw new Error("API chưa trả về thông tin ảnh hợp lệ.");
  return { media_id: body.media_id, url: body.url };
}

export async function readMediaImage(mediaId: string, signal?: AbortSignal): Promise<{ media_id: string; url: string }> {
  const response = await adminFetch("/api/backend/admin/media/images/" + encodeURIComponent(mediaId), { signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không đọc được banner. Kiểm tra phiên bản backend và liên kết MEDIA.");
  if (body?.media_id !== mediaId || typeof body?.url !== "string" || !/^https?:\/\//.test(body.url)) throw new Error("API chưa trả về thông tin banner hợp lệ.");
  return { media_id: body.media_id, url: body.url };
}
