import type { Metadata } from "next";
import { PageHeading } from "@/components/common/PageHeading";
import { SectionNav } from "@/components/common/SectionNav";
import { termsNavigation, termsSections } from "./termsData";
import styles from "./page.module.css";

// The Figma frame is named FAQ – 1, but its supplied screenshot is a terms page.
export const metadata: Metadata = {
  title: "Shop Terms & Conditions | Tech Store",
  description: "Shop terms and conditions of sale: products, payments, accounts and delivery.",
  robots: { index: false, follow: false },
};

export default function FaqPage() {
  return <div className={styles.page}>
    <PageHeading title="Shop Terms & Conditions" breadcrumbs={[{ label: "Home", href: "/" }, { label: "Shop Terms & Conditions" }]} />
    <div className={styles.layout}>
      <article className={styles.article} aria-labelledby="terms-heading">
        <h2 id="terms-heading">GENERAL TERMS AND CONDITIONS FOR SALE OF PRODUCTS AND SERVICES</h2>
        {termsSections.map(section => <section key={section.id} aria-labelledby={section.id} className={styles.section}>
          <h3 id={section.id} tabIndex={-1}>{section.title}</h3>
          {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          {section.definitions && <ol className={styles.definitions}>
            {section.definitions.map(definition => <li key={definition}>{definition}</li>)}
          </ol>}
        </section>)}
      </article>
      <aside className={styles.sidebar}>
        <SectionNav items={termsNavigation} label="Terms and conditions sections" />
      </aside>
    </div>
  </div>;
}
