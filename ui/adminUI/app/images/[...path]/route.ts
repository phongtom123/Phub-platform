/** Compatibility for legacy /images URLs after assets moved to public Storage. */
import { logLocalImageFailure } from "../../../src/lib/local-diagnostics";

export const runtime = "nodejs";
const mediaRoot = "https://btfhahnjydaiivvcqnna.supabase.co/storage/v1/object/public/media/products/";
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"]);
const maxBytes = 10 * 1024 * 1024;

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const fail = (status: number, reason: string, url?: string) => {
    if (url) logLocalImageFailure(url, "proxy", { status, reason });
    return new Response(null, { status, headers: { "Cache-Control": "no-store", "X-Phub-Media-Error": reason } });
  };
  // No arbitrary host, encoded traversal, query forwarding, cookie or API key.
  if (!path.length || path.join("/").length > 2048 || path.some(part =>
    !part || part === "." || part === ".." || part.length > 255 || /[/\\%\x00-\x1f\x7f]/.test(part)
  ) || !/\.(png|jpe?g|webp|avif|gif)$/i.test(path[path.length - 1])) return fail(404, "invalid-path");
  const url = mediaRoot + path.map(encodeURIComponent).join("/");
  try {
    const upstream = await fetch(url, {
      headers: { Accept: "image/*" }, credentials: "omit", redirect: "error",
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      return fail(upstream.status === 404 ? 404 : 502, `upstream-${upstream.status}`, url);
    }
    const type = upstream.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!type || !imageTypes.has(type)) {
      await upstream.body?.cancel(); return fail(502, "invalid-content-type", url);
    }
    if (Number(upstream.headers.get("content-length")) > maxBytes) {
      await upstream.body?.cancel(); return fail(502, "image-too-large", url);
    }
    const reader = upstream.body?.getReader();
    if (!reader) return fail(502, "empty-image", url);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); return fail(502, "image-too-large", url); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    if (!size) return fail(502, "empty-image", url);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(bytes, { headers: {
      "Content-Type": type, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    return fail(timeout ? 504 : 502, timeout ? "upstream-timeout" : "upstream-unavailable", url);
  }
}
