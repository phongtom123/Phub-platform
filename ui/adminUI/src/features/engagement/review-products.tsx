"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Package, Search } from "lucide-react";
import { adminFetch } from "@internal/lib/admin-fetch";
import { dataHref } from "@internal/lib/data-navigation";
import { engagementRequest, type Page } from "../../../../shared/engagement";
import styles from "./engagement.module.css";
import productStyles from "./review-products.module.css";

type Product = { ma_sp: string; ten_sp: string; sku: string; thuong_hieu: string | null; trang_thai: number; duong_dan_anh?: string | null };

export function reviewProductsHref(query: string, page: number, productId?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("products_page", String(page));
  if (productId) params.set("product_id", productId);
  return `/reviews${params.size ? `?${params}` : ""}`;
}

function validProducts(value: Page<Product>, page: number) {
  if (!value || !Array.isArray(value.data) || value.page !== page || value.page_size !== 20 ||
      !Number.isSafeInteger(value.total) || value.total < 0 ||
      value.data.some(product => typeof product.ma_sp !== "string" || typeof product.ten_sp !== "string" || typeof product.sku !== "string")) {
    throw new Error("API chưa trả danh sách sản phẩm hợp lệ.");
  }
  return value;
}

export function ReviewProducts({ query, page }: { query: string; page: number }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(query);
  const [reload, setReload] = useState(0);
  const identity = JSON.stringify([query, page, reload]);
  const [state, setState] = useState<{ identity: string; data?: Page<Product>; error?: string } | null>(null);
  const current = state?.identity === identity ? state : null;
  useEffect(() => setKeyword(query), [query]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, page: String(page), page_size: "20" });
    engagementRequest<Page<Product>>(`data/products?${params}`, { signal: controller.signal, cache: "reload" }, adminFetch)
      .then(value => { if (!controller.signal.aborted) setState({ identity, data: validProducts(value, page) }); })
      .catch(error => { if (!controller.signal.aborted) setState({ identity, error: error instanceof Error ? error.message : "Không tải được sản phẩm." }); });
    return () => controller.abort();
  }, [identity, query, page]);

  function search(event: FormEvent) {
    event.preventDefault();
    const next = keyword.trim();
    if (next === query && page === 1) setReload(value => value + 1);
    else router.push(reviewProductsHref(next, 1));
  }

  return <>
    <form className={productStyles.search} onSubmit={search} role="search" aria-label="Tìm sản phẩm để xem đánh giá">
      <label><span>Tìm sản phẩm</span><input aria-label="Tìm sản phẩm" value={keyword} maxLength={100} onChange={event => setKeyword(event.target.value)} placeholder="Nhập tên, mã sản phẩm hoặc SKU…" /></label>
      <button className={styles.primary}><Search size={17} aria-hidden="true" /> Tìm kiếm</button>
      <button type="button" onClick={() => setReload(value => value + 1)}>Làm mới</button>
    </form>
    {!current ? <p role="status">Đang tải sản phẩm…</p> : current.error ? <div className={styles.error} role="alert">{current.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></div> : current.data && <>
      <p className={styles.muted}>{current.data.total} sản phẩm · Chọn sản phẩm để xem nhận xét của khách hàng.</p>
      {current.data.data.length ? <div className={productStyles.products}>{current.data.data.map(product =>
        <Link className={productStyles.product} key={product.ma_sp} href={reviewProductsHref(query, page, product.ma_sp)}>
          <div className={productStyles.productTop}><span className={productStyles.icon}><Package aria-hidden="true" size={22} /></span><span className={productStyles.brand}>{product.thuong_hieu || "Chưa có thương hiệu"}</span></div>
          <h2>{product.ten_sp}</h2><p className={styles.muted}>{product.sku}</p>
          <div className={productStyles.productBottom}><span className={styles.muted}>{product.trang_thai === 0 ? "Tạm ngừng" : "Đang hoạt động"}</span><strong>Xem đánh giá <ChevronRight size={16} aria-hidden="true" /></strong></div>
        </Link>)}</div> : <div className={productStyles.empty}><Package size={30} aria-hidden="true" /><h2>Không tìm thấy sản phẩm</h2><p>Thử tìm bằng tên hoặc mã sản phẩm khác.</p></div>}
      <div className={styles.actions}><button disabled={page <= 1} onClick={() => router.push(reviewProductsHref(query, page - 1))}>Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(current.data.total / 20))}</span><button disabled={page * 20 >= current.data.total} onClick={() => router.push(reviewProductsHref(query, page + 1))}>Sau</button></div>
    </>}
  </>;
}

export function ReviewProductHeading({ productId }: { productId: string }) {
  const params = useSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [failedImage, setFailedImage] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ key: JSON.stringify([productId]) });
    setError("");
    engagementRequest<Page<Product>>(`data/products?${query}`, { signal: controller.signal, cache: "reload" }, adminFetch)
      .then(value => {
        if (controller.signal.aborted) return;
        const selected = value?.data?.[0];
        if (!selected || value.data.length !== 1 || selected.ma_sp !== productId) throw new Error("Không tìm thấy sản phẩm này.");
        setProduct(selected);
      }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được thông tin sản phẩm."); });
    return () => controller.abort();
  }, [productId, reload]);
  const requestedPage = Number(params.get("products_page") || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10000 ? requestedPage : 1;
  const source = product?.duong_dan_anh?.trim() || "";
  const showImage = /^(https?:\/\/|\/(?!\/))/.test(source) && failedImage !== source;
  return <>
    <Link className={productStyles.back} href={reviewProductsHref(params.get("q") || "", page)}><ArrowLeft size={17} aria-hidden="true" /> Danh sách sản phẩm</Link>
    <section className={productStyles.summary} aria-label="Sản phẩm đang xem đánh giá">
      <span className={productStyles.thumbnail}>{showImage ? <img src={source} alt={product?.ten_sp || "Ảnh sản phẩm"} onError={() => setFailedImage(source)} /> : <Package size={30} aria-hidden="true" />}</span>
      <div className={productStyles.productInfo}><p className={productStyles.eyebrow}>ĐÁNH GIÁ SẢN PHẨM</p><h1>{product?.ten_sp || productId}</h1>{product && <div className={productStyles.productMeta}><code>{product.sku}</code>{product.thuong_hieu && <span>{product.thuong_hieu}</span>}</div>}</div>
      <Link className={productStyles.detailLink} href={dataHref("products", { key: JSON.stringify([productId]) })}>Chi tiết sản phẩm <ChevronRight size={16} aria-hidden="true" /></Link>
    </section>
    {error && <p role="alert" className={styles.error}>{error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
  </>;
}
