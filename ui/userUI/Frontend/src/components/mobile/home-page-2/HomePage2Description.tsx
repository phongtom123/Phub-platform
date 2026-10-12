"use client";

import { useState } from "react";
import { Button } from "@/components/common/Button";
import { homePage2Description } from "./homePage2Data";
import styles from "./HomePage2.module.css";

export function HomePage2Description() {
  const [expanded, setExpanded] = useState(false);
  return <section className={styles.description} aria-label="Giới thiệu dòng MSI Prestige">
    <div id="homepage2-description" className={expanded ? styles.descriptionExpanded : styles.descriptionCollapsed}>
      {homePage2Description.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    </div>
    <Button variant="outline" aria-expanded={expanded} aria-controls="homepage2-description" onClick={() => setExpanded(value => !value)}>{expanded ? "Thu gọn" : "Xem thêm"}</Button>
  </section>;
}
