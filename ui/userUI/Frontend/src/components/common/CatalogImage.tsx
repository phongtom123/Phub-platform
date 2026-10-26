"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { placeholderImage, safeImageUrl } from "@/lib/catalog/types";

/** Public catalog URLs load directly; no shared image-host configuration needed. */
export function CatalogImage(props: ImageProps) {
  const [failedSource, setFailedSource] = useState<ImageProps["src"] | null>(null);
  const src = failedSource === props.src ? placeholderImage : typeof props.src === "string" ? safeImageUrl(props.src) : props.src;
  return <Image {...props} alt={props.alt} src={src} unoptimized onError={() => setFailedSource(props.src)} />;
}
