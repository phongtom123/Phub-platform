import Link from "next/link";
import { TabNav } from "@/components/common/TabNav";
import type { DetailProduct } from "@/data/product-details";
import { ProductAboutTab } from "./ProductAboutTab";
import { ProductDetailsTab } from "./ProductDetailsTab";
import { ProductSpecsTab } from "./ProductSpecsTab";
import { productPage1Tabs } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

type Tab = "about" | "details" | "specs";

export function ProductInfo({ product, activeTab }: { product: DetailProduct; activeTab: Tab }) {
  const tabs = productPage1Tabs.map(tab => ({ label: tab.label, href: `/main/product/${product.id}?tab=${tab.id}` }));

  return <section className={styles.info} aria-label="Thông tin sản phẩm">
    <TabNav items={tabs} activeHref={`/main/product/${product.id}?tab=${activeTab}`} label="Thông tin sản phẩm" className={styles.tabs} />
    <h1>{product.name}</h1>
    <p className={styles.reviewPrompt}>Hãy là người đầu tiên đánh giá sản phẩm này</p>
    {activeTab === "about" && <ProductAboutTab product={product} />}
    {activeTab === "details" && <ProductDetailsTab product={product} />}
    {activeTab === "specs" && <ProductSpecsTab product={product} />}
    <div className={styles.meta}>
      <p><strong>Cần tư vấn?</strong> <Link href="/contact-us">Liên hệ</Link></p>
      <span>SKU {product.sku}</span>
    </div>
  </section>;
}
