export function safeAuthRedirect(
  value: string | null | undefined,
  fallback: string,
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://phub.local");
    if (parsed.origin !== "https://phub.local" || parsed.pathname.startsWith("/auth/")) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function authPageHref(path: string, redirectTo: string, fallback: string) {
  return redirectTo === fallback
    ? path
    : `${path}?redirect=${encodeURIComponent(redirectTo)}`;
}
