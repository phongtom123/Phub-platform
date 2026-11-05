/** Development-only diagnostics. Never log raw request/response bodies or errors. */
export function diagnosticImageUrl(source: string): string {
  try {
    const url = new URL(source, "http://phub-local.invalid");
    if (url.protocol === "blob:") return "[local-file-preview]";
    if (!["https:", "http:"].includes(url.protocol)) return "[unsupported-image-url]";
    // Strip credentials, query (including signed tokens) and fragments.
    return (url.origin === "http://phub-local.invalid" ? "" : url.origin) + url.pathname;
  } catch { return "[invalid-image-url]"; }
}

export function logLocalImageFailure(source: string, stage: "proxy" | "preview" | "editor" | "viewer", details?: { status: number; reason: string }) {
  if (process.env.NODE_ENV !== "development") return;
  console.warn("[PHUB:image]", {
    event: "load-failed", stage, url: diagnosticImageUrl(source), ...details,
  });
}
