import { adminFetch } from "./admin-fetch";

export async function uploadProductImage(file: File, signal?: AbortSignal): Promise<string> {
  const response = await adminFetch("/api/backend/admin/media/images", {
    method: "POST", headers: { "Content-Type": file.type }, body: file, signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404) throw new Error("Backend chưa có API upload ảnh. Cần deploy backend mới trước khi tải ảnh.");
    throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được ảnh lên Storage.");
  }
  if (typeof body?.url !== "string" || !/^https?:\/\//.test(body.url)) throw new Error("API chưa trả về URL ảnh hợp lệ.");
  return body.url;
}
