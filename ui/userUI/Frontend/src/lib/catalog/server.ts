import "server-only";
import { CatalogApiError, readJson, validateProduct } from "./client";

export function backendUrl(path: string, search = ""): URL {
  const base = new URL(process.env.PHUB_API_BASE_URL || "http://127.0.0.1:8000");
  if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid backend protocol");
  return new URL(`${base.pathname.replace(/\/$/, "")}/api/catalog/${path}${search}`, base.origin);
}

export async function fetchBackend(path: string, search = "") {
  return fetch(backendUrl(path, search), {
    method: "GET", cache: "no-store", signal: AbortSignal.timeout(15_000), redirect: "error",
    headers: { Accept: "application/json" },
  });
}

export async function getProduct(id: string) {
  if (id === "." || id === ".." || /[\\/\u0000-\u001f\u007f]/.test(id)) throw new CatalogApiError("Mã sản phẩm không hợp lệ.", 422);
  return validateProduct(await readJson(await fetchBackend(`products/${encodeURIComponent(id)}`)));
}
