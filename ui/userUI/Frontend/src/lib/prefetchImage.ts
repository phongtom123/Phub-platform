import { isSvgUrl } from "@/lib/media";

const NEXT_IMAGE_WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const pending = new Map<string, HTMLImageElement>();
const warmed = new Set<string>();

function candidateWidth(renderedWidth: number, density: number) {
  const target = renderedWidth * density;
  return NEXT_IMAGE_WIDTHS.find(width => width >= target) ?? NEXT_IMAGE_WIDTHS.at(-1)!;
}

function optimizedUrl(source: string, width: number) {
  return `/_next/image?url=${encodeURIComponent(source)}&w=${width}&q=75`;
}

/** Warm the exact responsive Next image candidate at low browser priority. */
export function prefetchOptimizedImage(source: string, renderedWidth: number) {
  const key = `${renderedWidth}:${source}`;
  if (typeof window === "undefined" || warmed.has(key) || pending.has(key)) return;
  const oneX = candidateWidth(renderedWidth, 1);
  const twoX = candidateWidth(renderedWidth, 2);
  const image = new window.Image();
  pending.set(key, image);
  image.decoding = "async";
  image.fetchPriority = "low";
  image.onload = () => { pending.delete(key); warmed.add(key); };
  image.onerror = () => pending.delete(key);
  if (isSvgUrl(source)) {
    image.src = source;
    return;
  }
  image.srcset = `${optimizedUrl(source, oneX)} 1x, ${optimizedUrl(source, twoX)} 2x`;
  image.src = optimizedUrl(source, twoX);
}
