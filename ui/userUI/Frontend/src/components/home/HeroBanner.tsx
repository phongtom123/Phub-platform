"use client";

import Image from "next/image";
import { useState } from "react";
import { heroSlides as slides } from "./homeData";
import styles from "./Home.module.css";

export function HeroBanner() {
  const [active, setActive] = useState(0);
  const slide = slides[active];
  return <section className={styles.hero} aria-label="Ưu đãi nổi bật" aria-roledescription="trình chiếu">
    <a href={slide.href} aria-label={slide.alt}>
      <Image src={slide.image} alt={slide.alt} fill priority={active === 0} className={styles.heroImage} />
    </a>
    <button className={`${styles.arrow} ${styles.previous}`} onClick={() => setActive((active + slides.length - 1) % slides.length)} aria-label="Ưu đãi trước"><Image src="/images/figma-mobile/home-imgComponent4.svg" width={35} height={60} alt="" /></button>
    <button className={`${styles.arrow} ${styles.next}`} onClick={() => setActive((active + 1) % slides.length)} aria-label="Ưu đãi tiếp theo"><Image src="/images/figma-mobile/home-imgComponent95.svg" width={35} height={60} alt="" /></button>
    <span className={styles.srOnly} aria-live="polite">Ưu đãi {active + 1} trên {slides.length}</span>
  </section>;
}
