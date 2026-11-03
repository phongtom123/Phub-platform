"use client";
import { useShopping } from "@/components/shopping/ShoppingProvider";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { IconButton } from "@/components/common/icon";
import { HeaderSearch } from "./HeaderSearch";
import { AccountMenu, CartPreview, GuestAvatar } from "./HeaderPanels";
import { useCategories } from "@/lib/catalog/useCategories";
import { categoryHref } from "@/lib/catalog/categories";
import { MobileCategoryDrawer } from "@/components/mobile/menu/MobileCategoryDrawer";
import { CatalogMegaMenu, CategoryMenuIcon } from "./CatalogMegaMenu";
import styles from "./Header.module.css";
import { useRouter } from "next/navigation";
import { AUTH_SESSION_EVENT, getSession, logoutSession, type SessionUser } from "../../../../../shared/auth-client";

type Dropdown = "account" | "cart";
type Panel = Dropdown | "categories" | "mobile" | "notice" | null;

export default function AltHeader() {
  const router = useRouter();
  const shop = useShopping();
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef<Dropdown | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const catalog = useCategories();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  function close(restoreFocus = false) {
    setPanel(null);
    setActiveCategoryId(null);
    hoverRef.current = null;
    if (restoreFocus) triggerRef.current?.focus();
  }

  function toggle(next: Panel, trigger: HTMLElement) {
    triggerRef.current = trigger;
    const wasHover = hoverRef.current === next;
    hoverRef.current = null;
    setActiveCategoryId(null);
    setPanel(current => (current === next && !wasHover ? null : next));
  }

  function hoverOpen(next: Dropdown, event: ReactPointerEvent<HTMLElement>) {
    if (!window.matchMedia("(min-width: 1100px) and (hover: hover)").matches) return;
    if (event.pointerType !== "mouse" || (panel && hoverRef.current === null)) return;
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

  useEffect(() => {
    const controller = new AbortController();
    function changed(event: Event) {
      setSession((event as CustomEvent<SessionUser | null>).detail);
      setSessionLoading(false);
    }
    window.addEventListener(AUTH_SESSION_EVENT, changed);
    getSession(controller.signal)
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setSessionLoading(false));
    return () => {
      controller.abort();
      window.removeEventListener(AUTH_SESSION_EVENT, changed);
    };
  }, []);

  useEffect(() => {
    if (panel !== "categories") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const mobile = window.matchMedia("(max-width: 1099px)");
    function changed() { setPanel(null); setActiveCategoryId(null); }
    mobile.addEventListener("change", changed);
    return () => {
      document.body.style.overflow = previous;
      mobile.removeEventListener("change", changed);
    };
  }, [panel]);

  useEffect(() => {
    function dismissOutside(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) {
        hoverRef.current = null;
        setPanel(null);
        setActiveCategoryId(null);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || (!panel && !activeCategoryId)) return;
      event.preventDefault();
      hoverRef.current = null;
      setPanel(null);
      setActiveCategoryId(null);
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
  }, [activeCategoryId, panel]);

  async function signOut() {
    try {
      await logoutSession();
      setSession(null);
      close();
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể đăng xuất lúc này.");
      setPanel("notice");
    }
  }

  const activeCategory = catalog.data.find(item => item.id === activeCategoryId) ?? catalog.data[0];

  function dropdownProps(name: Dropdown) {
    return { "data-open": panel === name, "aria-hidden": panel !== name, inert: panel !== name };
  }

  return (
    <header ref={rootRef} className={styles.header}>
      {panel === "categories" && <button type="button" className={styles.categoryBackdrop}
        aria-label="Đóng danh mục sản phẩm" tabIndex={-1} onClick={() => close(true)} />}
      <div className={styles.mainBar}>
        <Link href="/" className={styles.logo} aria-label="Tech Store — Trang chủ" onClick={() => close()}>
          <Image src="/images/1.png" alt="" width={34} height={41} preload />
        </Link>
        <button type="button" className={styles.categoryButton}
          aria-label={panel === "categories" || panel === "mobile" ? "Đóng danh mục" : "Mở danh mục"}
          aria-expanded={panel === "categories" || panel === "mobile"}
          aria-controls={id + (panel === "mobile" ? "-mobile" : "-categories")}
          onClick={event => toggle(window.matchMedia("(max-width: 1099px)").matches ? "mobile" : "categories", event.currentTarget)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          Danh mục
        </button>

        {panel === "categories" && <nav id={id + "-categories"}
          aria-label="Danh mục sản phẩm"
          className={styles.categoryMenu}
        >
          <div className={styles.categoryList}>
          {catalog.loading && <p role="status">Đang tải danh mục…</p>}
          {catalog.error && <p role="alert">Không tải được danh mục. <button type="button" onClick={catalog.retry}>Thử lại</button></p>}
          {catalog.data.map(item => (
            <div key={item.id} className={styles.categoryNav} data-active={activeCategory?.id === item.id}
              onMouseEnter={() => setActiveCategoryId(item.id)}
              onFocusCapture={() => setActiveCategoryId(item.id)}>
              <Link href={categoryHref(item.id)} onClick={() => close()}
                aria-controls={id + "-category-options"} aria-expanded={activeCategory?.id === item.id}>
                <CategoryMenuIcon label={item.label} /><span>{item.label}</span><span aria-hidden="true">›</span>
              </Link>
            </div>
          ))}
          <Link className={styles.dealsLink} href="/main/product" onClick={() => close()}>Tất Cả Sản Phẩm</Link>
          </div>
          {activeCategory && <CatalogMegaMenu key={activeCategory.id} id={id + "-category-options"}
            category={activeCategory} onNavigate={() => close()} />}
        </nav>}

        <div id={id + "-search"} className={styles.searchSlot} onFocusCapture={() => { setPanel(null); setActiveCategoryId(null); hoverRef.current = null; }}>
          <Suspense fallback={<span role="status">Đang mở tìm kiếm…</span>}><HeaderSearch onNavigate={href => { close(); router.push(href); }} /></Suspense>
        </div>

        <div className={styles.actions}>
          <div
            className={styles.actionAnchor}
            onPointerEnter={event => hoverOpen("cart", event)}
            onPointerLeave={hoverClose}
          >
            <IconButton className={styles.actionButton} label={`Giỏ hàng, ${shop.count} sản phẩm`}
              aria-expanded={panel === "cart"} aria-controls={id + "-cart"}
              onClick={event => toggle("cart", event.currentTarget)}>
              <Image className={styles.cartIcon} src="/icons/header/cart.svg" alt="" width={25} height={25} />
            </IconButton>
            <div id={id + "-cart"} className={styles.cartPanel} {...dropdownProps("cart")}>
              <CartPreview onNavigate={() => close()} />
            </div>
          </div>

          <div
            className={styles.actionAnchor}
            onPointerEnter={event => hoverOpen("account", event)}
            onPointerLeave={hoverClose}
          >
            <IconButton
              className={styles.actionButton}
              label={session ? `Mở tài khoản của ${session.name}` : "Mở tài khoản"}
              aria-expanded={panel === "account"}
              aria-controls={id + "-account"}
              onClick={event => toggle("account", event.currentTarget)}
            >
              <GuestAvatar name={session?.name} avatarUrl={shop.customer?.avatar_url} />
            </IconButton>
            <div className={styles.accountPanel} id={id + "-account"} {...dropdownProps("account")}>
              <AccountMenu
                onNavigate={() => close()}
                user={session}
                loading={sessionLoading}
                onLogout={signOut}
              />
            </div>
          </div>
        </div>

        <MobileCategoryDrawer
          catalog={catalog}
          id={id + "-mobile"}
          open={panel === "mobile"}
          onClose={() => close(true)}
        />
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
