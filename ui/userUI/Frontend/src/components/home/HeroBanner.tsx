"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getBanners, type CatalogBanner } from "@/lib/catalog/banners";
import { automaticRefresh } from "@/lib/automaticRefresh";
import styles from "./HeroBanner.module.css";

export function HeroBanner() {
  const [banners, setBanners] = useState<CatalogBanner[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [index, setIndex] = useState(0), [version, setVersion] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const stop = automaticRefresh(async () => {
      try {
        const items = await getBanners(controller.signal);
        if (!controller.signal.aborted) { setBanners(items); setError(""); }
      } catch (cause) {
        if (!controller.signal.aborted) { setBanners([]); setError(cause instanceof Error ? cause.message : "Chưa tải được banner quảng cáo."); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
      return true;
    }, 60_000);
    return () => { controller.abort(); stop(); };
  }, [version]);

  const available = banners.filter(banner => !failed.includes(banner.image_url));
  const selected = Math.min(index, Math.max(0, available.length - 1));
  const banner = available[selected];
  function retry() { setFailed([]); setLoading(true); setVersion(value => value + 1); }
  if (loading) return <section className={styles.loading} aria-label="Banner quảng cáo" role="status">Đang tải banner…</section>;
  if (error || banners.length > 0 && !banner) return <section className={styles.error} aria-label="Banner quảng cáo"><p>{error || "Chưa tải được hình ảnh quảng cáo."}</p><button type="button" onClick={retry}>Thử lại</button></section>;
  if (!banner) return null;

  return <section className={styles.hero} style={{ aspectRatio: `${banner.width || 1398} / ${(banner.height || 328) * .7}` }}
    aria-label="Banner quảng cáo" aria-roledescription="trình chiếu">
    <h1 className={styles.srOnly}>PHUB Store — PC nguyên bộ và linh kiện máy tính</h1>
    <Link className={styles.link} href="/main/product" aria-label={`Xem sản phẩm: ${banner.title}`}>
      <Image key={banner.image_url} src={banner.image_url} alt={banner.alt_text || banner.title}
        width={banner.width ?? 1398} height={banner.height ?? 328}
        sizes="(max-width: 760px) 100vw, 1398px" unoptimized loading="eager"
        className={styles.image} onError={() => setFailed(current => [...current, banner.image_url])} />
    </Link>
    {available.length > 1 && <>
      <button type="button" className={`${styles.arrow} ${styles.previous}`} aria-label="Banner trước" onClick={() => setIndex((selected - 1 + available.length) % available.length)}>‹</button>
      <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label="Banner tiếp theo" onClick={() => setIndex((selected + 1) % available.length)}>›</button>
      <div className={styles.dots} aria-label="Chọn banner">{available.map((item, position) => <button key={item.id} type="button" aria-label={`Xem banner ${position + 1}`} aria-pressed={selected === position} onClick={() => setIndex(position)} />)}</div>
    </>}
  </section>;
}
