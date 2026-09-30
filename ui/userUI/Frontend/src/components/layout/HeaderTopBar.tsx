"use client";

import Image from "next/image";
import Link from "next/link";
import type { PointerEvent } from "react";
import { ShopInfo } from "./HeaderPanels";
import styles from "./Header.module.css";

interface HeaderTopBarProps {
  id: string;
  compactMobile?: boolean;
  open: boolean;
  onToggle: (trigger: HTMLElement) => void;
  onEnter: (event: PointerEvent<HTMLElement>) => void;
  onLeave: (event: PointerEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

export function HeaderTopBar({ id, compactMobile = false, open, onToggle, onEnter, onLeave, onClose }: HeaderTopBarProps) {
  return <div className={styles.topBar}>
    <div className={styles.topInner}>
      {compactMobile && <Link href="/" className={styles.catalogTopLogo} aria-label="Tech Store — Trang chủ" onClick={onClose}><Image src="/images/figma-mobile/header-img1.svg" alt="" width={23} height={28} /></Link>}
      <div className={styles.shopAnchor} onPointerEnter={onEnter} onPointerLeave={onLeave}>
        <button type="button" className={styles.hoursButton} aria-expanded={open} aria-controls={`${id}-shop`} onClick={event => onToggle(event.currentTarget)}>
          <span>T2–T5:</span><strong>9:00 AM – 5:30 PM</strong>
          <Image src="/images/figma-mobile/header-imgFrame97.svg" alt="" width={16} height={14.7692} />
        </button>
        <div id={`${id}-shop`} className={styles.shopPanel} data-open={open} aria-hidden={!open} inert={!open}><ShopInfo /></div>
      </div>
      <p className={styles.showroom}>Ghé thăm cửa hàng tại 1234 Nguyễn Thị Minh Khai, Quận 1. <a href="#footer-contact" onClick={onClose}>Liên hệ ngay</a></p>
      <a href="tel:0901234567" className={styles.mobileContact}>Gọi: 090 123 4567</a>
      <div className={styles.topRight}>
        <a href="tel:0901234567">Hotline: 090 123 4567</a>
        <Image src="/icons/header/facebook.svg" alt="Facebook" width={20} height={20} />
        <Image src="/icons/header/instagram.svg" alt="Instagram" width={20} height={20} />
      </div>
    </div>
  </div>;
}
