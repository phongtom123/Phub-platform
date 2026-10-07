import Link from "next/link";
import type { DetailProduct } from "@/data/product-details";
import { ProductDetailActions } from "./ProductDetailActions";
import { desktopProductDetailTabs, type ProductDetailTab } from "./desktopProductDetailData";
import { ProductGallery } from "@/components/catalog/ProductGallery";
import { productHref } from "@/lib/catalog/types";
import styles from "./detail.module.css";

export function DesktopProductDetail({ product, activeTab }: { product: DetailProduct; activeTab: ProductDetailTab }) {
  return <article className={styles.page}>
    <div className={styles.purchaseBar}><div className={styles.purchaseInner}>
      <nav className={styles.tabs} aria-label="Product information tabs">{desktopProductDetailTabs.map(tab => <Link key={tab.id} className={activeTab === tab.id ? styles.activeTab : undefined} href={productHref(product.id) + "?tab=" + tab.id}>{tab.label}</Link>)}</nav>
      <ProductDetailActions product={product} />
    </div></div>
    <section className={styles.productHero}>
      <div className={styles.productCopy}><div className={styles.copyInner}>
        <p className={styles.breadcrumb}><Link href="/">Trang chủ</Link><span>›</span><Link href={"/main/product?" + new URLSearchParams({ category_id: product.categoryId })}>{product.category}</Link>{product.brand && <><span>›</span>{product.brand}</>}</p>
        <h1>{product.name}</h1>
        {activeTab === "about" && <p className={styles.summary} style={{ whiteSpace: "pre-line" }}>{product.description || "Chưa có mô tả sản phẩm."}</p>}
        {activeTab === "details" && <ul className={styles.detailList}>
          <li>Loại sản phẩm: {product.category}</li>
          {product.brand && <li>Thương hiệu: {product.brand}</li>}
          <li>Đơn vị: {product.unit}</li><li>Bảo hành: {product.warrantyMonths} tháng</li>
        </ul>}
        {activeTab === "specs" && (product.specifications.length
          ? <dl className={styles.specTable}>{product.specifications.map((spec, index) => <div key={index}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>
          : <p>Chưa có thông số kỹ thuật.</p>)}
        <div className={styles.metaRow}><p><strong>Cần tư vấn?</strong> <Link href="/contact-us">Liên hệ</Link></p><small>SKU {product.sku}</small></div>
        <a className={styles.moreInfo} href="#features">+ THÔNG TIN SẢN PHẨM</a>
      </div></div>
      <div className={styles.productVisual}>
        <ProductGallery product={product} className={styles.mainProductImage} />
      </div>
    </section>
    <section className={styles.support}><div className={styles.supportInner}>
      <div className={styles.supportLinks}><Link href="/contact-us">Hỗ trợ sản phẩm <span>→</span></Link><Link href="/faq">Câu hỏi thường gặp <span>→</span></Link><Link href="/main/product">Khám phá sản phẩm khác <span>→</span></Link></div>
      <div className={styles.agentArt} aria-hidden="true"><div className={styles.agentHead}>◡</div><div className={styles.headset}>⌕</div><div className={styles.agentBody} /></div>
    </div></section>
    <section id="features" className={styles.features}><div className={styles.featuresInner}>
      <h2>Thông số kỹ thuật</h2>
      {product.specifications.length ? <div className={styles.featureGrid}>
        {product.specifications.map((spec, index) => <article key={index} className={styles.feature}><h3>{spec.label}</h3><p style={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{spec.value}</p></article>)}
      </div> : <p>Chưa có thông số kỹ thuật.</p>}
    </div></section>
    <div className={styles.footerGap} />
  </article>;
}
