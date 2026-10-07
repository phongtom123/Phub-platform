import { fetchBackend } from "@/lib/catalog/server";

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message, details: [] } }, { status });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const allowed = path.length === 1 && ["products", "categories", "brands"].includes(path[0])
    || path.length === 2 && path[0] === "products" && path[1].length <= 100;
  const validSegments = path.every(segment => segment !== "." && segment !== ".." && !/[\\/\u0000-\u001f\u007f]/.test(segment));
  if (!allowed || !validSegments) return error(404, "NOT_FOUND", "Không tìm thấy tài nguyên.");
  try {
    const upstream = await fetchBackend(path.map(encodeURIComponent).join("/"), new URL(request.url).search);
    const body = await upstream.json();
    if (!upstream.ok && (!body?.error || typeof body.error.message !== "string")) {
      return error(502, "INVALID_RESPONSE", "Không thể tải dữ liệu sản phẩm.");
    }
    return Response.json(body, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return error(503, "DATA_SERVICE_UNAVAILABLE", "Không thể kết nối dịch vụ sản phẩm. Vui lòng thử lại.");
  }
}
