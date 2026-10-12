"use client";

import Image from "next/image";
import { IconButton } from "@/components/common/icon";
import styles from "./Home.module.css";

export function HomeFloatingActions() {
  return <aside className={styles.floatingActions} aria-label="Liên hệ hỗ trợ">
    <IconButton label="Về đầu trang" onClick={() => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><Image src="/images/figma-mobile/home-imgComponent36.svg" width={40} height={40} alt="" /></IconButton>
    <a href="/contact-us" aria-label="Gửi yêu cầu hỗ trợ" className={styles.chatAction}>
      <Image src="/images/figma-mobile/home-imgComponent35.svg" width={40} height={40} alt="" />
      <Image className={styles.chatLogo} src="/images/figma-mobile/home-imgLogo.svg" width={26.6667} height={26.6667} alt="" />
    </a>
  </aside>;
}
