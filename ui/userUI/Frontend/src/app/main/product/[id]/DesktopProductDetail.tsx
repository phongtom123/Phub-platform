import Link from "next/link";
import type { DetailProduct } from "@/data/product-details";
import { ProductDetailActions } from "./ProductDetailActions";
import { ProductInformation } from "@/components/catalog/ProductInformation";
import { ProductStockSummary } from "@/components/catalog/ProductStockSummary";
import type { ProductStock } from "@/lib/catalog/useProductStock";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductBreadcrumb } from "@/components/catalog/ProductBreadcrumb";
import styles from "./detail.module.css";

export function DesktopProductDetail({ product, stock }: { product: DetailProduct; stock: ProductStock }) {
  const contactHref = `/contact-us?${new URLSearchParams({ product_id: product.id, product_name: product.name })}`;
  return <article className={styles.page}>
    <div className={styles.overview}>
    <div className={styles.purchaseBar}><div className={styles.purchaseInner}>
      <Link className={styles.informationLink} href="#product-information">Mô tả và thông số <span aria-hidden="true">↓</span></Link>
      <div className={styles.purchaseControls}><ProductDetailActions product={product} stock={stock} /></div>
    </div></div>
    <section className={styles.productHero}>
      <div className={styles.breadcrumbWrap}>
        <ProductBreadcrumb product={product} className={styles.breadcrumb} />
      </div>
      <div className={styles.productCopy}><div className={styles.copyInner}>
        <h1>{product.name}</h1>
        <p className={styles.summary} style={{ whiteSpace: "pre-line" }}>{product.description || "Chưa có mô tả sản phẩm."}</p>
        <ProductStockSummary stock={stock} unit={product.unit} />
        <div className={styles.metaRow}><p><strong>Cần tư vấn?</strong> <Link href={contactHref}>Liên hệ</Link></p></div>
      </div></div>
      <div className={styles.productVisual}>
        <ProductGallery product={product} className={styles.mainProductImage} />
      </div>
    </section>
    </div>
    <ProductInformation product={product} />
    <section className={styles.support}><div className={styles.supportInner}>
      <div className={styles.supportLinks}><Link href={contactHref}>Hỗ trợ sản phẩm <span>→</span></Link><Link href="/faq">Câu hỏi thường gặp <span>→</span></Link><Link href="/main/product">Khám phá sản phẩm khác <span>→</span></Link></div>
      <div className={styles.agentArt} aria-hidden="true"><div className={styles.agentHead}>◡</div><div className={styles.headset}>⌕</div><div className={styles.agentBody} /></div>
    </div></section>
  </article>;
}
