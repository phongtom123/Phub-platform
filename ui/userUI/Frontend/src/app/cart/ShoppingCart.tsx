"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import styles from "./cart.module.css";
import { cents, money, moneyFromCents, vatCents } from "@/lib/shopping/money";

interface CartQuantityInputProps {
  sku: string;
  quantity: number;
  maximum: number | undefined;
  onUpdate: (sku: string, quantity: number) => void;
}

function CartQuantityInput({ sku, quantity, maximum, onUpdate }: CartQuantityInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = (value: string) => {
    const parsed = Number(value);
    const nextQuantity = value === "" || !Number.isInteger(parsed)
      ? quantity
      : Math.min(maximum ?? quantity, Math.max(1, parsed));

    onUpdate(sku, nextQuantity);
    setDraft(null);
  };

  return (
    <div className={styles.qtyControl}>
      <button
        type="button"
        onClick={() => {
          setDraft(null);
          onUpdate(sku, Math.max(1, quantity - 1));
        }}
        disabled={quantity <= 1 || !maximum}
        aria-label="Giảm số lượng"
      >
        -
      </button>
      <input
        type="number"
        min={1}
        max={maximum}
        disabled={!maximum}
        step={1}
        inputMode="numeric"
        aria-label="Số lượng"
        value={draft ?? String(quantity)}
        onChange={(event) => {
          const value = event.target.value;
          if (!/^\d*$/.test(value)) return;
          setDraft(value);

          if (value === "") return;

          const parsed = Number(value);
          if (maximum !== undefined && Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum) {
            onUpdate(sku, parsed);
          }
        }}
        onBlur={(event) => commitDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      <button
        type="button"
        onClick={() => {
          setDraft(null);
          onUpdate(sku, Math.min(maximum ?? quantity, quantity + 1));
        }}
        disabled={maximum === undefined || quantity >= maximum}
        aria-label="Tăng số lượng"
      >
        +
      </button>
    </div>
  );
}

export function ShoppingCart() {
  const router = useRouter();
  const shop = useShopping();
  const [checkingStock, setCheckingStock] = useState(false);
  const checkoutPending = useRef(false);

  const selectedTotal = shop.selectedLines.reduce((sum, line) => sum + cents(line.unit_price) * BigInt(line.quantity), BigInt(0));
  const tax = shop.taxRate === null ? null : shop.selectedLines.reduce((sum, line) => sum + vatCents(cents(line.unit_price) * BigInt(line.quantity), shop.taxRate!), BigInt(0));
  const formattedSelectedTotal = moneyFromCents(selectedTotal);
  const amountTooLarge = tax !== null && selectedTotal + tax > cents("9999999999999999.99");
  const stockBlocked = !!shop.stockError || shop.selectedLines.some(line => line.unavailable || shop.availability[line.sku] === undefined || line.quantity > shop.availability[line.sku]);

  const totalSelectedQuantity = shop.selectedLines.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const isAllSelected =
    shop.lines.length > 0 && shop.selectedLines.length === shop.lines.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      shop.deselectAll();
    } else {
      shop.selectAll();
    }
  };

  const handleCheckout = async () => {
    if (stockBlocked || tax === null || amountTooLarge) return;
    if (checkoutPending.current || shop.cartLoading || !shop.selectedLines.length) return;
    checkoutPending.current = true;
    setCheckingStock(true);
    try {
      if (!await shop.checkSelectedStock()) return;
      if (shop.authStatus === "guest") {
        router.push("/auth/login?redirect=%2Fcheckout");
      } else if (shop.authStatus === "authenticated") {
        router.push("/checkout");
      }
    } finally {
      checkoutPending.current = false;
      setCheckingStock(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb}>
          <Link href="/">Trang chủ</Link>
          <span>›</span>
          <Link href="/cart">Giỏ hàng</Link>
        </nav>

        <h1>Giỏ hàng {shop.count > 0 ? `(${shop.count} sản phẩm)` : ""}</h1>

        {shop.notice && (
          <div
            style={{
              padding: "10px 16px",
              background: "#effaf2",
              color: "#187b34",
              borderRadius: 6,
              marginBottom: 20,
              fontSize: 14,
            }}
          >
            {shop.notice}
          </div>
        )}

        {shop.lines.length === 0 ? (
          <section className={styles.empty}>
            <h2>Giỏ hàng của bạn đang trống</h2>
            <p>
              Hãy khám phá các linh kiện, phụ kiện và sản phẩm công nghệ tuyệt vời và thêm vào giỏ hàng nhé!
            </p>
            <Link
              href="/main/product"
              style={{
                display: "inline-block",
                marginTop: 18,
                padding: "12px 28px",
                background: "#0156ff",
                color: "#fff",
                borderRadius: 24,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Khám phá sản phẩm
            </Link>
          </section>
        ) : (
          <div className={styles.layout}>
            <div>
              <div className={styles.tableHead}>
                <input
                  type="checkbox"
                  className={styles.selectCircle}
                  aria-label="Chọn hoặc bỏ chọn tất cả sản phẩm"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                />
                <span>Sản phẩm</span>
                <span>Đơn giá</span>
                <span>Số lượng</span>
                <span>Thành tiền</span>
                <span className={styles.srOnly}>Hành động</span>
              </div>

              {shop.lines.map((line) => {
                const formattedUnitPrice = money(line.unit_price, line.currency);
                const formattedLineTotal = moneyFromCents(cents(line.unit_price) * BigInt(line.quantity), line.currency);
                const available = shop.availability[line.sku];

                return (
                  <div key={line.sku} className={styles.item}>
                    <input
                      type="checkbox"
                      className={styles.selectCircle}
                      checked={line.selected !== false}
                      onChange={(e) => shop.select(line.sku, e.target.checked)}
                      aria-label={`Chọn sản phẩm ${line.name}`}
                    />
                    <div className={styles.product}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={line.image || "/images/catalog/product-placeholder.svg"}
                        alt={line.name || line.sku}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "/images/catalog/product-placeholder.svg";
                        }}
                      />
                      <div>
                        <Link
                          href={`/main/product/${encodeURIComponent(line.product_id)}`}
                          style={{
                            textDecoration: "none",
                            color: "inherit",
                            fontWeight: 500,
                          }}
                        >
                          {line.name || line.sku}
                        </Link>
                        <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                          SKU: {line.sku}
                        </p>
                      </div>
                    </div>
                    <div style={{ fontWeight: 500 }}>{formattedUnitPrice}</div>
                    <div className={styles.qty}>
                      <CartQuantityInput
                        sku={line.sku}
                        quantity={line.quantity}
                        maximum={available}
                        onUpdate={shop.update}
                      />
                      <small className={styles.stock} role="status">{available === undefined ? "Đang kiểm tra tồn kho…" : available === 0 ? "Hết hàng" : `Tối đa ${available.toLocaleString("vi-VN")} sản phẩm`}</small>
                      {available !== undefined && available > 0 && line.quantity > available && <button type="button" className={styles.adjustStock} onClick={() => shop.update(line.sku, available)}>Giảm còn {available}</button>}
                    </div>
                    <strong style={{ color: "#0156ff" }}>{formattedLineTotal}</strong>
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        title="Xóa sản phẩm"
                        className={styles.remove}
                        onClick={() => shop.remove(line.sku)}
                        aria-label={`Xóa ${line.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className={styles.cartActions}>
                <Link href="/main/product">← Tiếp tục mua sắm</Link>
                <button type="button" onClick={() => shop.clear()}>
                  Xóa tất cả
                </button>
              </div>
            </div>

            <aside className={styles.summary}>
              <h2>Tổng quan giỏ hàng</h2>
              <div className={styles.totals}>
                <p>
                  <span>Số lượng chọn mua:</span>
                  <strong>{totalSelectedQuantity} món</strong>
                </p>
                <p>
                  <span>Tạm tính:</span>
                  <strong>{formattedSelectedTotal}</strong>
                </p>
                <p><span>Thuế VAT ({shop.taxRate ? Number(shop.taxRate) : "…"}%)</span><strong>{tax === null ? "Đang xác nhận…" : moneyFromCents(tax)}</strong></p>
                <p className={styles.orderTotal}><span>Thành tiền sau thuế</span><strong>{tax === null ? "—" : moneyFromCents(selectedTotal + tax)}</strong></p>
                <small>
                  Đã gồm VAT. Phí vận chuyển được xác nhận riêng; voucher được áp dụng ở bước đặt hàng.
                </small>
              </div>
              {stockBlocked && <div className={styles.stockWarning} role="alert"><p>{shop.stockError || "Vui lòng kiểm tra số lượng và tồn kho trước khi đặt hàng."}</p><button type="button" onClick={shop.refreshStock}>Kiểm tra lại tồn kho</button></div>}
              {amountTooLarge && <p className={styles.stockWarning} role="alert">Tổng tiền vượt giới hạn xử lý của đơn hàng. Vui lòng giảm số lượng.</p>}

              <button
                type="button"
                className={styles.checkout}
                disabled={
                  checkingStock ||
                  shop.cartLoading ||
                  shop.selectedLines.length === 0 ||
                  stockBlocked || amountTooLarge || tax === null ||
                  shop.authStatus === "loading" ||
                  shop.authStatus === "unavailable"
                }
                onClick={handleCheckout}
                aria-busy={checkingStock}
              >
                {checkingStock
                  ? "Đang kiểm tra tồn kho…"
                  : shop.selectedLines.length === 0
                  ? "Vui lòng chọn sản phẩm"
                  : shop.authStatus === "guest"
                    ? `Đăng nhập để thanh toán (${shop.selectedLines.length})`
                    : `Tiến hành đặt hàng (${shop.selectedLines.length})`}
              </button>

              {shop.authStatus === "guest" && (
                <p
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    color: "#555",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  💡 <strong>Gợi ý:</strong>{" "}
                  <Link
                    href="/auth/login?redirect=/checkout"
                    style={{ color: "#0156ff", textDecoration: "underline" }}
                  >
                    Đăng nhập
                  </Link>{" "}
                  hoặc{" "}
                  <Link
                    href="/auth/register?redirect=/checkout"
                    style={{ color: "#0156ff", textDecoration: "underline" }}
                  >
                    đăng ký
                  </Link>{" "}
                  để chuyển giỏ hàng này vào tài khoản và thanh toán.
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
