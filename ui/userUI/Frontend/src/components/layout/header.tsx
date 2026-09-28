"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { IconButton } from "@/components/common/icon";
import { SearchInput } from "@/components/common/SearchInput";
import { AccountMenu, CartPreview, GuestAvatar, ShopInfo } from "./HeaderPanels";
import { headerCategories } from "./headerData";
import { MegaMenu } from "./MegaMenu";
import styles from "./Header.module.css";

type Dropdown = "shop" | "account" | "cart" | "mega";
type Panel = Dropdown | "mobile" | "notice" | null;

export default function Header() {
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef<Dropdown | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState("");

  function close(restoreFocus = false) {
    setPanel(null);
    setSearchOpen(false);
    hoverRef.current = null;
    if (restoreFocus) triggerRef.current?.focus();
  }

  function toggle(next: Panel, trigger: HTMLElement) {
    triggerRef.current = trigger;
    const wasHover = hoverRef.current === next;
    hoverRef.current = null;
    setSearchOpen(false);
    setPanel(current => current === next && !wasHover ? null : next);
  }

  function hoverOpen(next: Dropdown, event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || searchOpen || (panel && hoverRef.current === null)) return;
    triggerRef.current = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : event.currentTarget.querySelector("button");
    hoverRef.current = next;
    setPanel(next);
  }

  function hoverClose(event: ReactPointerEvent<HTMLDivElement>) {
    if (hoverRef.current && !event.currentTarget.contains(document.activeElement)) {
      hoverRef.current = null;
      setPanel(null);
    }
  }

  function showPreview(label: string) {
    hoverRef.current = null;
    setSearchOpen(false);
    setNotice(label + ": hiện chỉ là giao diện, chưa kết nối chức năng.");
    setPanel("notice");
  }

  useEffect(() => {
    function dismissOutside(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) {
        hoverRef.current = null;
        setPanel(null);
        setSearchOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || (!panel && !searchOpen)) return;
      event.preventDefault();
      hoverRef.current = null;
      setPanel(null);
      setSearchOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", escape);
    };
  }, [panel, searchOpen]);

  function dropdownProps(name: Dropdown) {
    return { "data-open": panel === name, "aria-hidden": panel !== name, inert: panel !== name };
  }

  return (
    <header ref={rootRef} className={styles.header}>
      <div className={styles.topBar}>
        <div className={styles.topInner}>
          <div className={styles.shopAnchor} onPointerEnter={event => hoverOpen("shop", event)} onPointerLeave={hoverClose}>
            <button type="button" className={styles.hoursButton} aria-expanded={panel === "shop"} aria-controls={id + "-shop"} onClick={event => toggle("shop", event.currentTarget)}>
              <span>T2-T5:</span> <strong>9:00 AM - 5:30 PM</strong>
              <Image src="/icons/header/chevron.svg" alt="" width={16} height={15} style={{ width: 16, height: 15 }} />
            </button>
            <div id={id + "-shop"} className={styles.shopPanel} {...dropdownProps("shop")}><ShopInfo /></div>
          </div>
          <p className={styles.showroom}>Ghé thăm cửa hàng tại 1234 Nguyễn Thị Minh Khai, Quận 1. <a href="#footer-contact" onClick={() => close()}>Liên hệ ngay</a></p>
          <a href="#footer-contact" className={styles.mobileContact} onClick={() => close()}>Liên hệ ngay</a>
          <div className={styles.topRight}>
            <a href="tel:0901234567">Hotline: 090 123 4567</a>
            <Image src="/icons/header/facebook.svg" alt="Facebook" width={20} height={20} />
            <Image src="/icons/header/instagram.svg" alt="Instagram" width={20} height={20} />
          </div>
        </div>
      </div>

      <div className={styles.mainBar} onPointerLeave={event => { if (hoverRef.current === "mega") hoverClose(event); }}>
        <Link href="/main/landing" className={styles.logo} aria-label="PHUB Store — Trang chủ" onClick={() => close()}>
          <Image src="/images/1.png" alt="" width={34} height={41} priority />
        </Link>
        <IconButton className={styles.mobileToggle} label={panel === "mobile" ? "Đóng danh mục" : "Mở danh mục"} aria-expanded={panel === "mobile"} aria-controls={id + "-mobile"} onClick={event => toggle("mobile", event.currentTarget)}>
          <span className={styles.hamburger} aria-hidden="true"><span /><span /><span /></span>
        </IconButton>

        <nav aria-label="Danh mục sản phẩm" className={[styles.navigation, searchOpen && styles.navigationHidden].filter(Boolean).join(" ")}>
          {headerCategories.map(item => <Link key={item.id} href={item.href}
            aria-expanded={item.id === "laptops" ? panel === "mega" : undefined}
            aria-controls={item.id === "laptops" ? id + "-mega" : undefined}
            onPointerEnter={event => { if (item.id === "laptops") hoverOpen("mega", event); }}
            onClick={() => close()}>{item.label}</Link>)}
        </nav>

        {searchOpen && <div id={id + "-search"} className={styles.searchSlot}>
          <SearchInput autoFocus className={styles.searchForm} placeholder="Tìm theo Tên hoặc Mã SP..." onSearch={query => showPreview("Tìm kiếm “" + query + "”")} />
        </div>}

        <div className={styles.actions}>
          <IconButton className={styles.searchToggle} label={searchOpen ? "Đóng tìm kiếm" : "Mở tìm kiếm"} aria-expanded={searchOpen} aria-controls={id + "-search"} onClick={event => {
            triggerRef.current = event.currentTarget;
            hoverRef.current = null;
            setSearchOpen(!searchOpen);
            setPanel(null);
          }}>
            {searchOpen ? <span aria-hidden="true" className={styles.closeGlyph}>×</span> : <Image src="/icons/header/search.svg" alt="" width={18} height={18} />}
          </IconButton>
          <div className={styles.actionAnchor} onPointerEnter={event => hoverOpen("cart", event)} onPointerLeave={hoverClose}>
            <IconButton className={styles.actionButton} label="Giỏ hàng, 0 sản phẩm" aria-expanded={panel === "cart"} aria-controls={id + "-cart"} onClick={event => toggle("cart", event.currentTarget)}>
              <Image className={styles.cartIcon} src="/icons/header/cart.svg" alt="" width={25} height={25} />
              <span className={styles.cartBadge} aria-hidden="true">0</span>
            </IconButton>
            <div className={styles.cartPanel} id={id + "-cart"} {...dropdownProps("cart")}><CartPreview onSelect={showPreview} /></div>
          </div>
          <div className={styles.actionAnchor} onPointerEnter={event => hoverOpen("account", event)} onPointerLeave={hoverClose}>
            <IconButton className={styles.actionButton} label="Mở tài khoản" aria-expanded={panel === "account"} aria-controls={id + "-account"} onClick={event => toggle("account", event.currentTarget)}>
              <GuestAvatar />
            </IconButton>
            <div className={styles.accountPanel} id={id + "-account"} {...dropdownProps("account")}><AccountMenu onNavigate={() => close()} /></div>
          </div>
        </div>

        <nav id={id + "-mobile"} className={styles.mobileMenu} aria-label="Danh mục trên điện thoại" data-open={panel === "mobile"} aria-hidden={panel !== "mobile"} inert={panel !== "mobile"}>
          {headerCategories.map(item => <Link key={item.id} href={item.href} onClick={() => close()}>{item.label}</Link>)}
        </nav>
        <div id={id + "-mega"} className={styles.megaPanel} {...dropdownProps("mega")}>
          <MegaMenu onClose={() => close(true)} />
        </div>
        {panel === "notice" && <div className={styles.notice}>
          <p role="status">{notice}</p><IconButton label="Đóng thông báo" onClick={() => close(true)}><span aria-hidden="true">×</span></IconButton>
        </div>}
      </div>
    </header>
  );
}
