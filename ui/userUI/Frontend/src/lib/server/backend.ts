import "server-only";

/** Runtime server configuration, shared by both customer proxies. */
export function backendBaseUrl(): URL {
  const value = process.env.PHUB_API_BASE_URL;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("PHUB_API_BASE_URL is required in production");
  }
  const url = new URL(value || "http://127.0.0.1:8001");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.search || url.hash
  ) {
    throw new Error("Invalid backend configuration");
  }
  return url;
}
