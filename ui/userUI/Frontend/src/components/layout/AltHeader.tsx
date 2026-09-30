"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { IconButton } from "@/components/common/icon";
import { SearchInput } from "@/components/common/SearchInput";
import { AccountMenu, GuestAvatar } from "./HeaderPanels";
import { headerCategories } from "./headerData";
import { MegaMenu } from "./MegaMenu";
import { HeaderTopBar } from "./HeaderTopBar";
import { MobileHeader } from "@/components/mobile/header/MobileHeader";
import { MobileCategoryDrawer } from "@/components/mobile/menu/MobileCategoryDrawer";
import { Account1 } from "@/components/mobile/account/Account1";
import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

type Dropdown = "shop" | "account" | "mega";
type Panel = Dropdown | "mobile" | "notice" | null;

export default function AltHeader() {
  const id = useId();
  const pathname = usePathname();
  const compactMobile = pathname === "/main/product" || pathname.startsWith("/main/product/");
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef<Dropdown | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  function close(restoreFocus = false) {
    setPanel(null);
    setSelectedCategoryId(null);
    setSearchOpen(false);
    hoverRef.current = null;
    if (restoreFocus) triggerRef.current?.focus();
  }

  function toggle(next: Panel, trigger: HTMLElement) {
    triggerRef.current = trigger;
    const wasHover = hoverRef.current === next;
    hoverRef.current = null;
    setSearchOpen(false);
    if (next === "mobile") setSelectedCategoryId(null);
    setPanel(current => (current === next && !wasHover ? null : next));
  }

  function hoverOpen(next: Dropdown, event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== "mouse" || searchOpen || (panel && hoverRef.current === null)) return;
    triggerRef.current =
      event.currentTarget instanceof HTMLButtonElement
        ? event.currentTarget
        : event.currentTarget.querySelector("button");
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
    <header ref={rootRef} className={[styles.header, compactMobile && styles.catalogMobile].filter(Boolean).join(" ")}>
      <HeaderTopBar
        id={id}
        compactMobile={compactMobile}
        open={panel === "shop"}
        onToggle={trigger => toggle("shop", trigger)}
        onEnter={event => hoverOpen("shop", event)}
        onLeave={hoverClose}
        onClose={() => close()}
      />
      <MobileHeader
        id={id}
        compact={compactMobile}
        panel={panel}
        cartCount={2}
        onToggle={toggle}
        onNavigate={() => close()}
        onSearch={query => showPreview(`Tìm kiếm “${query}”`)}
      />
      <div className={styles.mobilePanels}>
        <div id={id + "-mobile-account"} className={styles.accountPanel} {...dropdownProps("account")}>
          <Account1 onNavigate={() => close()} />
        </div>
      </div>

      <div
        className={styles.mainBar}
        onPointerLeave={event => {
          if (hoverRef.current === "mega") hoverClose(event);
        }}
      >
        <Link href="/" className={styles.logo} aria-label="Tech Store — Trang chủ" onClick={() => close()}>
          <Image src="/images/1.png" alt="" width={34} height={41} priority />
        </Link>
        <IconButton
          className={styles.mobileToggle}
          label={panel === "mobile" ? "Đóng danh mục" : "Mở danh mục"}
          aria-expanded={panel === "mobile"}
          aria-controls={id + "-mobile"}
          onClick={event => toggle("mobile", event.currentTarget)}
        >
          <span className={styles.hamburger} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </IconButton>

        <nav
          aria-label="Danh mục sản phẩm"
          className={[styles.navigation, searchOpen && styles.navigationHidden].filter(Boolean).join(" ")}
        >
          {headerCategories.map(item => (
            <button
              key={item.id}
              type="button"
              aria-expanded={item.id === "laptops" ? panel === "mega" : undefined}
              aria-controls={item.id === "laptops" ? id + "-mega" : undefined}
              onPointerEnter={event => {
                if (item.id === "laptops") hoverOpen("mega", event);
              }}
              onClick={event => {
                if (item.id === "laptops") toggle("mega", event.currentTarget);
                else {
                  triggerRef.current = event.currentTarget;
                  showPreview(item.label);
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {searchOpen && (
          <div id={id + "-search"} className={styles.searchSlot}>
            <SearchInput
              autoFocus
              className={styles.searchForm}
              placeholder="Tìm theo Tên hoặc Mã SP..."
              onSearch={query => showPreview("Tìm kiếm “" + query + "”")}
            />
          </div>
        )}

        <div className={styles.actions}>
          <IconButton
            className={styles.searchToggle}
            label={searchOpen ? "Đóng tìm kiếm" : "Mở tìm kiếm"}
            aria-expanded={searchOpen}
            aria-controls={id + "-search"}
            onClick={event => {
              triggerRef.current = event.currentTarget;
              hoverRef.current = null;
              setSearchOpen(!searchOpen);
              setPanel(null);
            }}
          >
            {searchOpen ? (
              <span aria-hidden="true" className={styles.closeGlyph}>
                ×
              </span>
            ) : (
              <Image src="/icons/header/search.svg" alt="" width={18} height={18} />
            )}
          </IconButton>

          <Link
            href="/cart"
            className={styles.actionButton}
            aria-label="Giỏ hàng, 2 sản phẩm"
            onClick={() => close()}
          >
            <Image className={styles.cartIcon} src="/icons/header/cart.svg" alt="" width={25} height={25} />
            <span className={styles.cartBadge} aria-hidden="true">
              2
            </span>
          </Link>

          <div
            className={styles.actionAnchor}
            onPointerEnter={event => hoverOpen("account", event)}
            onPointerLeave={hoverClose}
          >
            <IconButton
              className={styles.actionButton}
              label="Mở tài khoản"
              aria-expanded={panel === "account"}
              aria-controls={id + "-account"}
              onClick={event => toggle("account", event.currentTarget)}
            >
              <GuestAvatar />
            </IconButton>
            <div className={styles.accountPanel} id={id + "-account"} {...dropdownProps("account")}>
              <AccountMenu onNavigate={() => close()} />
            </div>
          </div>
        </div>

        <MobileCategoryDrawer
          id={id + "-mobile"}
          open={panel === "mobile"}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          onClose={() => close(true)}
        />
        <div id={id + "-mega"} className={styles.megaPanel} {...dropdownProps("mega")}>
          <MegaMenu onClose={() => close(true)} />
        </div>
        {panel === "notice" && (
          <div className={styles.notice}>
            <p role="status">{notice}</p>
            <IconButton label="Đóng thông báo" onClick={() => close(true)}>
              <span aria-hidden="true">×</span>
            </IconButton>
          </div>
        )}
      </div>
    </header>
  );
}
