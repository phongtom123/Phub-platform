"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import styles from "./cart.module.css";

export function ShoppingCart() {
  const router = useRouter();
  const shop = useShopping();

  const selectedTotal = shop.selectedLines.reduce((sum, line) => {
    return sum + parseFloat(line.unit_price || "0") * line.quantity;
  }, 0);

  const formattedSelectedTotal = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(selectedTotal);

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

  const handleCheckout = () => {
    if (shop.authStatus === "guest") {
      router.push("/auth/login?redirect=%2Fcheckout");
      return;
    }
    if (shop.authStatus === "authenticated") router.push("/checkout");
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
                const unitPrice = parseFloat(line.unit_price || "0");
                const lineTotal = unitPrice * line.quantity;
                const formattedUnitPrice = new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: line.currency || "VND",
                }).format(unitPrice);
                const formattedLineTotal = new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: line.currency || "VND",
                }).format(lineTotal);

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
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <button
                          type="button"
                          onClick={() =>
                            shop.update(line.sku, Math.max(1, line.quantity - 1))
                          }
                          style={{
                            width: 26,
                            height: 26,
                            border: "1px solid #ccc",
                            borderRadius: 4,
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                          disabled={line.quantity <= 1}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={line.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (val > 0) shop.update(line.sku, val);
                          }}
                          style={{
                            width: 44,
                            height: 28,
                            textAlign: "center",
                            border: "1px solid #ccc",
                            borderRadius: 4,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            shop.update(line.sku, line.quantity + 1)
                          }
                          style={{
                            width: 26,
                            height: 26,
                            border: "1px solid #ccc",
                            borderRadius: 4,
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          +
                        </button>
                      </div>
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
                <p className={styles.orderTotal}>
                  <span>Tạm tính:</span>
                  <strong>{formattedSelectedTotal}</strong>
                </p>
                <small>
                  Thuế VAT và phí vận chuyển sẽ được tính chi tiết tại bước thanh toán.
                </small>
              </div>

              <button
                type="button"
                className={styles.checkout}
                disabled={
                  shop.selectedLines.length === 0 ||
                  shop.authStatus === "loading" ||
                  shop.authStatus === "unavailable"
                }
                onClick={handleCheckout}
              >
                {shop.selectedLines.length === 0
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
