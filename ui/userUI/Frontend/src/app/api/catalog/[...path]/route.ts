import { fetchBackend } from "@/lib/catalog/server";

// Public lists identical for every visitor may be reused briefly by the browser.
// Prices, product details, stock and purchase states always stay no-store.
const browserCache: Record<string, string> = {
  categories: "public, max-age=60, stale-while-revalidate=300",
  brands: "public, max-age=60, stale-while-revalidate=300",
  colors: "public, max-age=60, stale-while-revalidate=300",
  banners: "public, max-age=60, stale-while-revalidate=300",
  facets: "public, max-age=30",
};

function cacheControl(path: string[], ok: boolean): string {
  return ok && path.length === 1 && Object.hasOwn(browserCache, path[0]) ? browserCache[path[0]] : "no-store";
}

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message, details: [] } }, { status });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const allowed = path.length === 1 && ["products", "categories", "brands", "colors", "banners", "availability", "purchase-states", "facets"].includes(path[0])
    || path.length === 2 && path[0] === "products" && path[1].length <= 100
    || path.length === 3 && path[0] === "products" && path[1].length <= 100 && path[2] === "availability";
  const validSegments = path.every(segment => segment !== "." && segment !== ".." && !/[\\/\u0000-\u001f\u007f]/.test(segment));
  if (!allowed || !validSegments) return error(404, "NOT_FOUND", "Không tìm thấy tài nguyên.");
  try {
    const upstream = await fetchBackend(path.map(encodeURIComponent).join("/"), new URL(request.url).search);
    const body = await upstream.json();
    if (!upstream.ok && (!body?.error || typeof body.error.message !== "string")) {
      return error(502, "INVALID_RESPONSE", "Không thể tải dữ liệu sản phẩm.");
    }
    return Response.json(body, { status: upstream.status, headers: { "Cache-Control": cacheControl(path, upstream.ok) } });
  } catch {
    return error(503, "DATA_SERVICE_UNAVAILABLE", "Không thể kết nối dịch vụ sản phẩm. Vui lòng thử lại.");
  }
}
