"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CustomerGate,
  useShopping,
} from "@/components/shopping/ShoppingProvider";
import {
  QuoteTotals,
  useCheckoutQuote,
  VoucherForm,
} from "@/components/shopping/CheckoutSummary";
import { TaxNotice } from "@/components/common/Price";
import { CatalogImage } from "@/components/common/CatalogImage";
import { cents, decimal, money } from "@/lib/shopping/money";
import shared from "@/components/shopping/shopping.module.css";
import styles from "./cart.module.css";

export function ShoppingCart() {
  return (
    <section className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb}>
          <Link href="/">Trang chủ</Link>
          <span>›</span>
          <strong>Giỏ hàng</strong>
        </nav>
        <h1>Giỏ hàng</h1>
        <CustomerGate>
          <CartContents />
        </CustomerGate>
      </div>
    </section>
  );
}
function CartContents() {
  const shop = useShopping();
  const router = useRouter();
  const [voucher, setVoucher] = useState<string | null>(null);
  const { quote, error, loading, reload } = useCheckoutQuote(voucher);
  const selectedTotal = shop.selectedLines.some(line => line.unavailable) ? null : decimal(
    shop.selectedLines.reduce((total, line) => total + cents(line.unit_price) * BigInt(line.quantity), BigInt(0)),
  );
  return (
    <div className={styles.layout}>
      <section className={styles.cartArea} aria-label="Sản phẩm trong giỏ">
        <div className={styles.tableHead}>
          <span />
          <span>Sản phẩm</span>
          <span>Đơn giá</span>
          <span>Số lượng</span>
          <span>Thành tiền</span>
          <span />
        </div>
        {shop.cartLoading && <p role="status">Đang cập nhật sản phẩm…</p>}
        {shop.lines.map((line) => (
          <article className={styles.item} key={line.sku}>
            <input className={styles.selectCircle} type="checkbox"
              aria-label={`Chọn ${line.name} (${line.sku})`}
              checked={line.selected !== false} disabled={shop.cartLoading}
              onChange={event => shop.select(line.sku, event.target.checked)} />
            <div className={styles.product}>
              {/* External catalog URLs are validated before entering the cart. */}
              {!line.unavailable && (
                <CatalogImage
                  src={line.image}
                  alt=""
                  width={100}
                  height={100}
                />
              )}
              <div>
                <Link
                  href={`/main/product/${encodeURIComponent(line.product_id)}`}
                >
                  {line.name}
                </Link>
                <p>SKU: {line.sku}</p>
                {line.unavailable && (
                  <p role="alert">
                    Sản phẩm chưa thể tải. Hãy tải lại trang hoặc xóa khỏi giỏ.
                  </p>
                )}
              </div>
            </div>
            <div>
              {!line.unavailable && (
                <>
                  <strong>{money(line.unit_price, line.currency)}</strong>
                  <TaxNotice />
                </>
              )}
            </div>
            <label className={styles.qty}>
              <span className={styles.srOnly}>Số lượng {line.sku}</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={line.quantity}
                disabled={shop.cartLoading}
                onChange={(event) =>
                  shop.update(line.sku, Number(event.target.value))
                }
              />
            </label>
            <strong>
              {!line.unavailable &&
                money(
                  decimal(cents(line.unit_price) * BigInt(line.quantity)),
                  line.currency,
                )}
            </strong>
            <button
              type="button"
              aria-label={`Xóa ${line.sku}`}
              className={styles.remove}
              disabled={shop.cartLoading}
              onClick={() => shop.remove(line.sku)}
            >
              ×
            </button>
          </article>
        ))}
        {!shop.lines.length && !shop.cartLoading && <p>Giỏ hàng đang trống.</p>}
        <p className={styles.selectedTotal} aria-live="polite">
          Tổng tiền sản phẩm đã chọn: <strong>{selectedTotal !== null && !shop.cartLoading
            ? money(selectedTotal, shop.selectedLines[0]?.currency || "VND") : ""}</strong>
        </p>
        <div className={styles.cartActions}>
          <button
            type="button"
            disabled={shop.cartLoading}
            onClick={shop.selectAll}
            aria-pressed={shop.lines.length > 0 && shop.selectedLines.length === shop.lines.length}
          >
            Chọn tất cả
          </button>
          <button
            type="button"
            disabled={shop.cartLoading || !shop.selectedLines.length || shop.selectedLines.some(line => line.unavailable)}
            onClick={() => router.push(`/checkout${voucher ? `?voucher=${encodeURIComponent(voucher)}` : ""}`)}
          >
            Thanh toán
          </button>
        </div>
      </section>
      <aside className={styles.summary}>
        <h2>Tóm tắt đơn</h2>
        <p role="status">Đã chọn {shop.selectedLines.length}/{shop.lines.length} sản phẩm để thanh toán.</p>
        {!shop.selectedLines.length && <p>Chọn sản phẩm bằng nút tròn bên trái.</p>}
        <VoucherForm
          value={voucher}
          onApply={setVoucher}
          disabled={!shop.selectedLines.length || shop.cartLoading}
        />
        {loading && <p role="status">Đang kiểm tra giá và tồn kho…</p>}
        {error && (
          <div className={shared.error} role="alert">
            <p>{error}</p>
            <button type="button" onClick={reload}>
              Thử lại
            </button>
          </div>
        )}
        {quote && (
          <>
            <QuoteTotals quote={quote} />
          </>
        )}
      </aside>
    </div>
  );
}
