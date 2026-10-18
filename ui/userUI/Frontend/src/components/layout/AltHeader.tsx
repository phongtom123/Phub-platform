"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { IconButton } from "@/components/common/icon";
import { SearchInput } from "@/components/common/SearchInput";
import { AccountMenu, CartPreview, GuestAvatar } from "./HeaderPanels";
import { useCategories } from "@/lib/catalog/useCategories";
import { categoryHref } from "@/lib/catalog/categories";
import { HeaderTopBar } from "./HeaderTopBar";
import { MobileCategoryDrawer } from "@/components/mobile/menu/MobileCategoryDrawer";
import { CatalogMegaMenu, warmAllCatalogMegaMenus, warmCatalogMegaMenu } from "./CatalogMegaMenu";
import styles from "./Header.module.css";
import { usePathname, useRouter } from "next/navigation";
import { AUTH_SESSION_EVENT, getSession, logoutSession, type SessionUser } from "../../../../../shared/auth-client";

type Dropdown = "shop" | "account" | "cart";
type Panel = Dropdown | "mobile" | "notice" | null;

export default function AltHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef<Dropdown | null>(null);
  const categoryCloseTimerRef = useRef<number | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const catalog = useCategories();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  function cancelCategoryClose() {
    if (categoryCloseTimerRef.current !== null) {
      window.clearTimeout(categoryCloseTimerRef.current);
      categoryCloseTimerRef.current = null;
    }
  }

  function openCategory(categoryId: string) {
    cancelCategoryClose();
    setActiveCategoryId(categoryId);
  }

  function scheduleCategoryClose(categoryId: string) {
    cancelCategoryClose();
    categoryCloseTimerRef.current = window.setTimeout(() => {
      setActiveCategoryId(current => current === categoryId ? null : current);
      categoryCloseTimerRef.current = null;
    }, 150);
  }

  function close(restoreFocus = false) {
    cancelCategoryClose();
    setPanel(null);
    setSearchOpen(false);
    setActiveCategoryId(null);
    hoverRef.current = null;
    if (restoreFocus) triggerRef.current?.focus();
  }

  function toggle(next: Panel, trigger: HTMLElement) {
    triggerRef.current = trigger;
    const wasHover = hoverRef.current === next;
    hoverRef.current = null;
    setSearchOpen(false);
    setActiveCategoryId(null);
    setPanel(current => (current === next && !wasHover ? null : next));
  }

  function hoverOpen(next: Dropdown, event: ReactPointerEvent<HTMLElement>) {
    if (!window.matchMedia("(min-width: 1100px) and (hover: hover)").matches) return;
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

  useEffect(() => () => {
    if (categoryCloseTimerRef.current !== null) window.clearTimeout(categoryCloseTimerRef.current);
  }, []);

  useEffect(() => {
    if ((pathname !== "/" && pathname !== "/main/landing") || catalog.loading || !catalog.data.length) return;
    let cancelled = false;
    let idleId: number | null = null;
    let gapTimer: number | null = null;

    async function warmInOrder() {
      try { await warmAllCatalogMegaMenus(catalog.data); }
      catch { return; }
      const targets = [
        ...catalog.data.map(category => ({ categoryId: category.id, subcategoryId: undefined })),
        ...catalog.data.flatMap(category => category.children.map(child => ({
          categoryId: category.id, subcategoryId: child.id,
        }))),
      ];
      for (const target of targets) {
        if (cancelled) return;
        try { await warmCatalogMegaMenu(target.categoryId, target.subcategoryId); }
        catch { /* Hover keeps the normal retry UI available. */ }
        if (cancelled) return;
        await new Promise<void>(resolve => { gapTimer = window.setTimeout(resolve, 250); });
      }
    }

    const delayTimer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(() => { void warmInOrder(); }, { timeout: 2_000 });
      } else {
        void warmInOrder();
      }
    }, 1_500);

    return () => {
      cancelled = true;
      window.clearTimeout(delayTimer);
      if (gapTimer !== null) window.clearTimeout(gapTimer);
      if (idleId !== null) window.cancelIdleCallback(idleId);
    };
  }, [catalog.data, catalog.loading, pathname]);

  useEffect(() => {
    function dismissOutside(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) {
        hoverRef.current = null;
        setPanel(null);
        setSearchOpen(false);
        setActiveCategoryId(null);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || (!panel && !searchOpen && !activeCategoryId)) return;
      event.preventDefault();
      hoverRef.current = null;
      setPanel(null);
      setSearchOpen(false);
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
  }, [activeCategoryId, panel, searchOpen]);

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

  function dropdownProps(name: Dropdown) {
    return { "data-open": panel === name, "aria-hidden": panel !== name, inert: panel !== name };
  }

  return (
    <header ref={rootRef} className={styles.header}>
      <HeaderTopBar
        id={id}
        open={panel === "shop"}
        onToggle={trigger => toggle("shop", trigger)}
        onEnter={event => hoverOpen("shop", event)}
        onLeave={hoverClose}
        onClose={() => close()}
      />

      <div className={styles.mainBar}>
        <Link href="/" className={styles.logo} aria-label="Tech Store — Trang chủ" onClick={() => close()}>
          <Image src="/images/1.png" alt="" width={34} height={41} priority />
        </Link>
        <IconButton
          className={styles.mobileToggle}
          label={panel === "mobile" ? "Đóng danh mục" : "Mở danh mục"}
          aria-expanded={panel === "mobile"}
          aria-controls={id + "-mobile"}
          aria-haspopup="dialog"
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
          {catalog.loading && <span role="status">Đang tải danh mục…</span>}
          {catalog.error && <span role="alert">Không tải được danh mục. <button type="button" onClick={catalog.retry}>Thử lại</button></span>}
          {catalog.data.map(item => (
            <div key={item.id} className={styles.categoryNav} data-active={activeCategoryId === item.id}
              onMouseEnter={() => openCategory(item.id)}
              onMouseLeave={() => scheduleCategoryClose(item.id)}
              onFocusCapture={() => openCategory(item.id)}
              onBlurCapture={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveCategoryId(null);
              }}>
              <Link href={categoryHref(item.id)} onClick={() => close()}
                aria-haspopup="true" aria-expanded={activeCategoryId === item.id}>{item.label}</Link>
              {activeCategoryId === item.id && <CatalogMegaMenu category={item} onNavigate={() => close()} onKeepOpen={cancelCategoryClose} />}
            </div>
          ))}
          <Link href="/main/product" onClick={() => close()}>Tất Cả Sản Phẩm</Link>
        </nav>

        {searchOpen && (
          <div id={id + "-search"} className={styles.searchSlot}>
            <SearchInput
              autoFocus
              className={styles.searchForm}
              placeholder="Tìm theo Tên hoặc Mã SP..."
              maxLength={100}
              onSearch={query => { close(); router.push(`/main/product?${new URLSearchParams({ q: query.trim() })}`); }}
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
              setActiveCategoryId(null);
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

          <div
            className={styles.actionAnchor}
            onPointerEnter={event => hoverOpen("cart", event)}
            onPointerLeave={hoverClose}
          >
            <IconButton className={styles.actionButton} label="Giỏ hàng, 0 sản phẩm"
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
              <GuestAvatar name={session?.name} />
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
