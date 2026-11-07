"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReviewList from "./review-list";
import { ReviewProducts, ReviewProductHeading } from "./review-products";
import styles from "./engagement.module.css";
import productStyles from "./review-products.module.css";

export default function ReviewsView() {
  const params = useSearchParams();
  const productId = params.get("product_id") || undefined;
  const all = !productId && params.get("view") === "all";
  const requestedPage = Number(params.get("products_page") || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10000 ? requestedPage : 1;

  return <section className={styles.page}>
    <nav className={productStyles.tabs} aria-label="Cách xem đánh giá">
      <Link href="/reviews" aria-current={!all ? "page" : undefined}>Theo sản phẩm</Link>
      <Link href="/reviews?view=all" aria-current={all ? "page" : undefined}>Tất cả đánh giá</Link>
    </nav>
    {productId ? <>
      <ReviewProductHeading key={`product:${productId}`} productId={productId} />
      <ReviewList key={`reviews:${productId}`} productId={productId} />
    </> : all ? <ReviewList key="all" /> : <>
      <header className={styles.heading}><div><h1>Đánh giá theo sản phẩm</h1><p className={styles.muted}>Tìm sản phẩm và mở danh sách đánh giá để xem nội dung, số sao và trạng thái hiển thị.</p></div></header>
      <ReviewProducts query={params.get("q") || ""} page={page} />
    </>}
  </section>;
}
