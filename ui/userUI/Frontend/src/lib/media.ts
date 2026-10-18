export const SUPABASE_MEDIA_ORIGIN = "https://btfhahnjydaiivvcqnna.supabase.co";
export const PRODUCT_MEDIA_BASE_URL = `${SUPABASE_MEDIA_ORIGIN}/storage/v1/object/public/media/products`;

export function isSvgUrl(source: string): boolean {
  return /\.svg(?:$|[?#])/i.test(source);
}

/** Resolve legacy frontend image paths directly to the public product bucket. */
export function resolveProductMediaUrl(source: string): string {
  if (!source.startsWith("/images/")) return source;
  return `${PRODUCT_MEDIA_BASE_URL}/${source.slice("/images/".length)}`;
}
