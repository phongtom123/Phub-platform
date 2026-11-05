"use client";

import type { PointerEvent } from "react";
import { ShopInfo } from "./HeaderPanels";
import { storeInfo } from "./headerData";
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
          <span>Mon–Thu:</span><strong>9:00 AM – 5:30 PM</strong>
          <span className={styles.hoursChevron} aria-hidden="true" />
        </button>
        <div id={`${id}-shop`} className={styles.shopPanel} data-open={open} aria-hidden={!open} inert={!open}><ShopInfo /></div>
      </div>
      <p className={styles.showroom}>Visit our showroom in {storeInfo.address} <a href="/contact-us" onClick={onClose}>Contact Us</a></p>
      <div className={styles.topRight}>
        <span>Call Us:</span><a href={storeInfo.phoneHref}>{storeInfo.phone}</a>
      </div>
    </div>
  </div>;
}
