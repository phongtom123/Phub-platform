import Image from "next/image";
import Link from "next/link";
import { supportLinks } from "./productPage1Data";
import styles from "./ProductPage1.module.css";

export function SupportLinksSection() {
  return <section className={styles.support} aria-label="Hỗ trợ mua sắm">
    <Image className={styles.supportImage} src="/images/figma-mobile/product-page-1/support-agent.png" alt="Nhân viên hỗ trợ khách hàng" width={336} height={311} sizes="336px" />
    <div className={styles.supportLinks}>
      {supportLinks.map(item => "href" in item
        ? <Link key={item.label} href={item.href} className={styles.supportLink}><span>{item.label}</span><span aria-hidden="true">→</span></Link>
        : <span key={item.label} className={styles.supportLink}><span>{item.label}</span><span aria-hidden="true">→</span></span>)}
    </div>
  </section>;
}
