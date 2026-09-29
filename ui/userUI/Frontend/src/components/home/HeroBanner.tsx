"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./Home.module.css";

const slides = [
  { image: "banner-msi.png", alt: "MSI — Score a bonus gaming monitor. Promotional design preview.", href: "#desktops" },
  { image: "banner-asus.png", alt: "ASUS TUF Gaming FX505 — Explore gaming laptops.", href: "#msi-laptops" },
];
export function HeroBanner() {
  const [active, setActive] = useState(0);
  const slide = slides[active];
  return <section className={styles.hero} aria-label="Featured promotions" aria-roledescription="carousel">
    <a href={slide.href} aria-label={slide.alt}>
      <Image src={`/images/home/${slide.image}`} alt={slide.alt} fill sizes="(max-width: 1430px) 100vw, 1398px" priority={active === 0} className={styles.heroImage} />
    </a>
    <button className={`${styles.arrow} ${styles.previous}`} onClick={() => setActive((active + slides.length - 1) % slides.length)} aria-label="Previous promotion">‹</button>
    <button className={`${styles.arrow} ${styles.next}`} onClick={() => setActive((active + 1) % slides.length)} aria-label="Next promotion">›</button>
    <span className={styles.srOnly} aria-live="polite">Promotion {active + 1} of {slides.length}</span>
  </section>;
}
