"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CatalogMetadataController } from "@/lib/catalog/useCatalog";
import { CatalogStatus } from "@/components/catalog/CatalogStatus";
import { brandImage } from "@/lib/catalog/brand-images";
import { isSvgUrl } from "@/lib/media";
import Link from "next/link";
import styles from "./BrandSection.module.css";

function BrandCard({ brand }: { brand: { id: string; name: string } }) {
  const source = brandImage(brand.name);
  const [failed, setFailed] = useState(false);
  return <Link className={styles.card} href={`/main/product?brand=${encodeURIComponent(brand.id)}`}
    aria-label={`Xem sản phẩm ${brand.name}`} prefetch={false}>
    {source && !failed
      ? <Image src={source} alt="" width={136} height={44} unoptimized={isSvgUrl(source)} onError={() => setFailed(true)} />
      : <span className={styles.wordmark}>{brand.name}</span>}
    <span className={styles.caption}>{brand.name}</span>
  </Link>;
}

function BrandRail({ brands }: { brands: { id: string; name: string }[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  function updateEdges() {
    const element = track.current;
    if (element) setEdges({ start: element.scrollLeft <= 2,
      end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
  }
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    return () => observer.disconnect();
  }, [brands]);
  function move(direction: number) {
    const element = track.current;
    element?.scrollBy({ left: direction * Math.max(180, element.clientWidth * .8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <section className={styles.section} aria-label="Thương hiệu sản phẩm">
    <div className={styles.heading}><h2>Thương hiệu</h2><div className={styles.controls}>
      <button type="button" aria-label="Thương hiệu trước" disabled={edges.start} onClick={() => move(-1)}>←</button>
      <button type="button" aria-label="Thương hiệu tiếp theo" disabled={edges.end} onClick={() => move(1)}>→</button>
    </div></div>
    <div ref={track} className={styles.track} onScroll={updateEdges}>
      {brands.map(brand => <BrandCard key={brand.id} brand={brand} />)}
    </div>
  </section>;
}

export function BrandSection({ metadata }: { metadata: CatalogMetadataController }) {
  if (metadata.loading || metadata.error) return <CatalogStatus loading={metadata.loading} error={metadata.error} retry={metadata.retry} />;
  if (!metadata.data.brands.length) return null;
  return <BrandRail brands={metadata.data.brands} />;
}
