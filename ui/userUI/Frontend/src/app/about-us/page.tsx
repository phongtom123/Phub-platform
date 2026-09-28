import type { Metadata } from "next";
import Image from "next/image";
import { PageHeading } from "@/components/common/PageHeading";
import { aboutSections } from "./aboutData";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "About Us | Tech Store", description: "Get to know Tech Store, our story, products and service." };

export default function AboutUsPage() {
  return <div className={styles.page}>
    <PageHeading title="About Us" breadcrumbs={[{ label: "Home", href: "/" }, { label: "About Us" }]} />
    {aboutSections.map((section, index) => <section key={section.id} aria-labelledby={section.id} className={[styles.band, section.dark ? styles.dark : styles.light].join(" ")}>
      <div className={styles.row}>
        <div className={styles.copy}>
          <h2 id={section.id}>
            {"icon" in section && <span className={styles.icon}><Image src={"/icons/about/" + section.icon.name + ".svg"} alt="" width={section.icon.width} height={section.icon.height} /></span>}
            <span>{section.title}</span>
          </h2>
          {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className={styles.visual}>
          <Image src={"/images/about/" + section.image} alt={section.alt} width={section.width} height={section.height}
            sizes="(max-width: 767px) 90vw, (max-width: 1200px) 45vw, 650px" priority={index === 0} />
        </div>
      </div>
    </section>)}
    <div className={styles.bottomSpace} aria-hidden="true" />
  </div>;
}
