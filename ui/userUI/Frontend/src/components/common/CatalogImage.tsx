"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { placeholderImage, safeImageUrl } from "@/lib/catalog/types";
import { isSvgUrl } from "@/lib/media";

/** Catalog URLs are restricted and optimized by the shared Next image configuration. */
export function CatalogImage(props: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  const src = failedSource === props.src ? placeholderImage : typeof props.src === "string" ? safeImageUrl(props.src) : props.src;
  const unoptimized = props.unoptimized ?? (typeof src === "string" && isSvgUrl(src));
  return <Image {...props} alt={props.alt} src={src} unoptimized={unoptimized} onError={() => setFailedSource(props.src)} />;
}
