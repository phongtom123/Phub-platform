import Link from "next/link";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import type { SessionUser } from "../../../../../shared/auth-client";
import { guestAccountItems, storeInfo } from "./headerData";
import styles from "./Header.module.css";

export function ShopInfo() {
  return (
    <div className={styles.shopInfo}>
      <section className={styles.shopRow} aria-label="Opening hours">
        <svg className={styles.shopInfoIcon} viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="12" />
          <path d="M16 9v8h7" />
        </svg>
        <div className={styles.shopHours}>
          <p>We are open:</p>
          <dl>
            {storeInfo.hours.map((item) => (
              <div key={item.days}>
                <dt>{item.days}:</dt>
                <dd>{item.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className={styles.shopRow} aria-label="Store address">
        <svg className={styles.shopInfoIcon} viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 29S6 20.7 6 12.8a10 10 0 0 1 20 0C26 20.7 16 29 16 29Z" />
          <circle cx="16" cy="13" r="3.5" />
        </svg>
        <address>Address: {storeInfo.address}</address>
      </section>
      <address className={styles.shopContact}>
        <p>
          Phones: <a href={storeInfo.phoneHref}>{storeInfo.phone}</a>
        </p>
        <p>
          E-mail: <a href={`mailto:${storeInfo.email}`}>{storeInfo.email}</a>
        </p>
      </address>
    </div>
  );
}

export function AccountMenu({
  onNavigate,
  user,
  loading,
  onLogout,
}: {
  onNavigate: () => void;
  user: SessionUser | null;
  loading: boolean;
  onLogout: () => void;
}) {
  const shop = useShopping();

  if (loading) return <p className={styles.accountIdentity}>Đang kiểm tra phiên đăng nhập…</p>;
  if (user) {
    const portal =
      user.role === "ADMIN"
        ? (process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3000")
        : (process.env.NEXT_PUBLIC_WAREHOUSE_URL ?? "http://localhost:3002");
    return (
      <nav aria-label="Tài khoản" className={styles.accountMenu}>
        <p className={styles.accountIdentity}>
          <strong>{user.name}</strong>
          <span>@{user.username}</span>
        </p>
        {user.role === "KHACH_HANG" ? (
          <Link href="/main/profile" onClick={onNavigate}>
            Tài khoản của tôi
          </Link>
        ) : (
          <a href={portal} onClick={onNavigate}>
            Mở cổng {user.role === "ADMIN" ? "quản trị" : "kho"}
          </a>
        )}
        <button type="button" onClick={onLogout}>
          Đăng xuất
        </button>
      </nav>
    );
  }
  return (
    <nav aria-label="Tài khoản" className={styles.accountMenu}>
      {shop.customer ? (
        <>
          <p>{shop.customer.name}</p>
          <Link href="/main/profile" onClick={onNavigate}>
            Tài khoản và đơn hàng
          </Link>
        </>
      ) : (
        guestAccountItems.map((label, index) => (
          <Link
            key={label}
            href={index === 0 ? "/auth/login" : "/auth/register"}
            onClick={onNavigate}
          >
            {label}
          </Link>
        ))
      )}
    </nav>
  );
}

export function GuestAvatar({ name, avatarUrl }: { name?: string; avatarUrl?: string | null }) {
  const safeAvatar = avatarUrl?.trim() && (/^https?:\/\//i.test(avatarUrl.trim()) || (avatarUrl.trim().startsWith("/") && !avatarUrl.trim().startsWith("//")))
    ? avatarUrl.trim() : null;
  return (
    <span className={styles.avatar}>
      {safeAvatar ? (
        <span className={styles.avatarImage} style={{ backgroundImage: `url(${JSON.stringify(safeAvatar)})` }} aria-hidden="true" />
      ) : name ? (
        <strong aria-hidden="true">{name.trim().charAt(0).toLocaleUpperCase("vi")}</strong>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2Z" />
        </svg>
      )}
    </span>
  );
}

export function CartPreview({ onNavigate }: { onNavigate?: () => void }) {
  const shop = useShopping();
  const subtotal = shop.lines.reduce(
    (sum, line) => {
      const price = Number.parseFloat(line.unit_price || "0");
      return sum + (Number.isFinite(price) ? price * line.quantity : 0);
    },
    0,
  );
  const formattedSubtotal = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: shop.lines[0]?.currency || "VND",
  }).format(subtotal);
  const checkoutDisabled =
    shop.lines.length === 0 ||
    shop.authStatus === "loading" ||
    shop.authStatus === "unavailable";
  const checkoutHref =
    shop.authStatus === "guest"
      ? "/auth/login?redirect=/checkout"
      : "/checkout";

  const checkoutContent = (
    <>
      <span className={styles.checkoutIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M3 4h2l1.6 9.1a2 2 0 0 0 2 1.65h7.8a2 2 0 0 0 1.94-1.5L20 7H6" />
          <circle cx="9" cy="19" r="1.25" />
          <circle cx="17" cy="19" r="1.25" />
        </svg>
      </span>
      <span>
        {checkoutDisabled
          ? shop.lines.length === 0
            ? "Giỏ hàng đang trống"
            : shop.authStatus === "loading"
              ? "Đang kiểm tra tài khoản"
              : "Thanh toán chưa sẵn sàng"
          : shop.authStatus === "guest"
            ? "Đăng nhập để thanh toán"
            : "Thanh toán"}
      </span>
      {!checkoutDisabled && <span className={styles.checkoutArrow} aria-hidden="true">→</span>}
    </>
  );

  return (
    <div className={styles.cartPreview}>
      <div className={styles.cartHead}>
        <div>
          <h2>Giỏ hàng của tôi</h2>
          <p>{shop.count} sản phẩm trong giỏ</p>
        </div>
        <Link href="/cart" className={styles.cartEdit} onClick={onNavigate}>
          Chỉnh sửa <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className={styles.cartItems}>
        {shop.lines.length === 0 ? (
          <div className={styles.emptyCart}>
            <span aria-hidden="true">🛒</span>
            <p>Giỏ hàng đang trống.</p>
          </div>
        ) : (
          shop.lines.slice(0, 3).map((line) => (
            <div key={line.sku} className={styles.cartLine}>
              <div className={styles.cartLineImage}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={line.image || "/images/catalog/product-placeholder.svg"} alt="" />
                <span>{line.quantity}</span>
              </div>
              <div className={styles.cartLineCopy}>
                <strong>{line.name || line.sku}</strong>
                <small>{line.sku}</small>
              </div>
              <button
                type="button"
                className={styles.cartLineRemove}
                onClick={() => shop.remove(line.sku)}
                aria-label={`Xóa ${line.name || line.sku} khỏi giỏ hàng`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      <div className={styles.cartFoot}>
        {shop.lines.length > 0 && (
          <p className={styles.subtotal}>
            <span>Tạm tính</span>
            <strong>{formattedSubtotal}</strong>
          </p>
        )}
        {checkoutDisabled ? (
          <span className={`${styles.checkout} ${styles.checkoutDisabled}`}>
            {checkoutContent}
          </span>
        ) : (
          <Link href={checkoutHref} className={styles.checkout} onClick={onNavigate}>
            {checkoutContent}
          </Link>
        )}
      </div>
    </div>
  );
}
