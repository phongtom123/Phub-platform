import type { Metadata } from "next";
import { PageHeading } from "@/components/common/PageHeading";
import { SectionNav } from "@/components/common/SectionNav";
import { termsNavigation, termsSections } from "./termsData";
import styles from "./page.module.css";

// The Figma frame is named FAQ – 1, but its supplied screenshot is a terms page.
export const metadata: Metadata = {
  title: "Điều khoản và điều kiện | PHUB Store",
  description: "Điều khoản mua bán về sản phẩm, giá bán, thanh toán, tài khoản và giao hàng.",
  robots: { index: false, follow: false },
};

export default function FaqPage() {
  return <div className={styles.page}>
    <PageHeading title="Điều khoản và điều kiện" breadcrumbs={[{ label: "Trang chủ", href: "/" }, { label: "Điều khoản và điều kiện" }]} />
    <div className={styles.layout}>
      <article className={styles.article} aria-labelledby="terms-heading">
        <h2 id="terms-heading">Điều khoản chung về mua bán sản phẩm và dịch vụ</h2>
        {termsSections.map(section => <section key={section.id} aria-labelledby={section.id} className={styles.section}>
          <h3 id={section.id} tabIndex={-1}>{section.title}</h3>
          {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          {section.definitions && <ol className={styles.definitions}>
            {section.definitions.map(definition => <li key={definition}>{definition}</li>)}
          </ol>}
        </section>)}
      </article>
      <aside className={styles.sidebar}>
        <SectionNav items={termsNavigation} label="Các mục điều khoản và điều kiện" />
      </aside>
    </div>
  </div>;
}
