"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Button";
import { IconButton } from "@/components/common/icon";
import { SearchInput } from "@/components/common/SearchInput";
import styles from "./MobileHeader.module.css";

interface MobileHeaderProps {
  id: string;
  compact?: boolean;
  panel: string | null;
  cartCount: number;
  onToggle: (panel: "mobile" | "account", trigger: HTMLElement) => void;
  onSearch: (query: string) => void;
  onNavigate: () => void;
}

export function MobileHeader({
  id,
  compact = false,
  panel,
  cartCount,
  onToggle,
  onSearch,
  onNavigate,
}: MobileHeaderProps) {
  const router = useRouter();
  return (
    <div className={[styles.header, compact && styles.compact].filter(Boolean).join(" ")}>
      <div className={styles.toolbar}>
        <IconButton
          label={panel === "mobile" ? "Đóng danh mục" : "Mở danh mục"}
          aria-expanded={panel === "mobile"}
          aria-controls={`${id}-mobile`}
          onClick={event => onToggle("mobile", event.currentTarget)}
        >
          <Image src="/images/figma-mobile/header-imgFrame104.svg" width={26} height={20} alt="" />
        </IconButton>
        {compact && (
          <SearchInput
            className={styles.search}
            iconSrc="/images/figma-mobile/header-imgGroup1921.svg"
            placeholder="Tìm kiếm sản phẩm"
            onSearch={onSearch}
          />
        )}
        {!compact && (
          <>
            <Link href="/" aria-label="Tech Store — Trang chủ" className={styles.logo} onClick={onNavigate}>
              <Image src="/images/figma-mobile/header-img1.svg" width={22.4462} height={27.2837} alt="" />
            </Link>
            <Button
              variant="outline"
              className={styles.deals}
              onClick={() => {
                onNavigate();
                const products = document.getElementById("new-products");
                if (products)
                  products.scrollIntoView({
                    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
                  });
                else router.push("/#new-products");
              }}
            >
              Ưu đãi
            </Button>
          </>
        )}
        <Link
          href="/cart"
          className={styles.cart}
          aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}
          onClick={onNavigate}
        >
          <Image src="/images/figma-mobile/header-imgJamShoppingCart.svg" width={27.2177} height={27.2177} alt="" />
          <span className={styles.badge} aria-hidden="true">
            <Image src="/images/figma-mobile/header-imgEllipse10.svg" width={17.4194} height={17.4194} alt="" />
            <span>{cartCount}</span>
          </span>
        </Link>
        <IconButton
          label="Mở tài khoản"
          className={styles.account}
          aria-expanded={panel === "account"}
          aria-controls={`${id}-mobile-account`}
          onClick={event => onToggle("account", event.currentTarget)}
        >
          <Image className={styles.accountRing} src="/images/figma-mobile/header-imgEllipse9.png" width={34} height={34} alt="" />
          <Image src="/images/figma-mobile/header-imgMdiAccount.svg" width={20} height={20} alt="" />
        </IconButton>
      </div>
      {!compact && (
        <SearchInput
          className={styles.search}
          iconSrc="/images/figma-mobile/header-imgGroup1921.svg"
          placeholder="Tìm kiếm sản phẩm"
          onSearch={onSearch}
        />
      )}
    </div>
  );
}
