import Image from "next/image";
import Link from "next/link";
import { supportLinks } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function SupportLinksSection({ productId, productName }: { productId?: string; productName?: string } = {}) {
  const contactHref = productId
    ? `/contact-us?${new URLSearchParams({ product_id: productId, ...(productName ? { product_name: productName } : {}) })}`
    : "/contact-us";
  return <section className={styles.support} aria-label="Hỗ trợ mua sắm">
    <Image className={styles.supportImage} src="/images/figma-mobile/product-page-1/support-agent.png" alt="Nhân viên hỗ trợ khách hàng" width={336} height={311} sizes="336px" />
    <div className={styles.supportLinks}>
      {supportLinks.map(item => <Link key={item.label} href={item.href === "/contact-us" ? contactHref : item.href} className={styles.supportLink}><span>{item.label}</span><span aria-hidden="true">→</span></Link>)}
    </div>
  </section>;
}
