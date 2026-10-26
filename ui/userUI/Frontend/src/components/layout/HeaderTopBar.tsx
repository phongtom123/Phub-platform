"use client";

import Image from "next/image";
import type { PointerEvent } from "react";
import { ShopInfo } from "./HeaderPanels";
import styles from "./Header.module.css";

interface HeaderTopBarProps {
  id: string;
  open: boolean;
  onToggle: (trigger: HTMLElement) => void;
  onEnter: (event: PointerEvent<HTMLElement>) => void;
  onLeave: (event: PointerEvent<HTMLDivElement>) => void;
  onClose: () => void;
}

export function HeaderTopBar({ id, open, onToggle, onEnter, onLeave, onClose }: HeaderTopBarProps) {
  return <div className={styles.topBar}>
    <div className={styles.topInner}>
      <div className={styles.shopAnchor} onPointerEnter={onEnter} onPointerLeave={onLeave}>
        <button type="button" className={styles.hoursButton} aria-expanded={open} aria-controls={`${id}-shop`} onClick={event => onToggle(event.currentTarget)}>
          <strong>PHUB · PC và linh kiện</strong>
          <Image src="/images/figma-mobile/header-imgFrame97.svg" alt="" width={16} height={14.7692} />
        </button>
        <div id={`${id}-shop`} className={styles.shopPanel} data-open={open} aria-hidden={!open} inert={!open}><ShopInfo /></div>
      </div>
      <p className={styles.showroom}><a href="/main/product" onClick={onClose}>Khám phá sản phẩm</a></p>
      <div className={styles.topRight}>
        <Image src="/icons/header/facebook.svg" alt="Facebook" width={20} height={20} />
        <Image src="/icons/header/instagram.svg" alt="Instagram" width={20} height={20} />
      </div>
    </div>
  </div>;
}
