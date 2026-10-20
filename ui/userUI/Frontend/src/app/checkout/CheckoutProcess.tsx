"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import { createOrder, getQuote } from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import type { Quote, OrderRequest, Receipt } from "@/lib/shopping/types";
import styles from "./checkout.module.css";

export function CheckoutProcess({ confirmation = false }: { confirmation?: boolean }) {
  const router = useRouter();
  const shop = useShopping();

  // Form states
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [province, setProvince] = useState("");
  const [ward, setWard] = useState("");
  const [note, setNote] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);

  // Quote & submission states
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [orderReceipt, setOrderReceipt] = useState<Receipt | null>(null);

  // Auto-fill recipient information from customer profile if available
  useEffect(() => {
    if (shop.customer) {
      if (shop.customer.name && !recipientName) setRecipientName(shop.customer.name);
      if (shop.customer.phone && !recipientPhone) setRecipientPhone(shop.customer.phone);
      if (shop.customer.address_line && !addressLine) setAddressLine(shop.customer.address_line);
      if (shop.customer.province && !province) setProvince(shop.customer.province);
      if (shop.customer.ward && !ward) setWard(shop.customer.ward);
    }
  }, [shop.customer]);

  // Fetch quote whenever selected lines or applied voucher changes
  useEffect(() => {
    if (shop.selectedLines.length === 0) {
      setQuote(null);
      return;
    }

    const items = shop.selectedLines.map((l) => ({
      sku: l.sku,
      quantity: l.quantity,
    }));

    const controller = new AbortController();
    setQuoteLoading(true);
    setQuoteError("");

    getQuote(items, appliedVoucher, controller.signal)
      .then((q) => {
        if (!controller.signal.aborted) {
          setQuote(q);
          setQuoteLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setQuote(null);
          setQuoteLoading(false);
          setQuoteError(
            err instanceof Error
              ? err.message
              : "Không thể lấy thông tin báo giá từ hệ thống."
          );
        }
      });

    return () => controller.abort();
  }, [shop.selectedLines, appliedVoucher]);

  const handleApplyVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const code = voucherCode.trim().toUpperCase();
    if (code) {
      setAppliedVoucher(code);
    }
  };

  const handleRemoveVoucher = () => {
    setVoucherCode("");
    setAppliedVoucher(null);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) {
      setSubmitError("Vui lòng nhập họ và tên người nhận.");
      return;
    }
    if (!recipientPhone.trim()) {
      setSubmitError("Vui lòng nhập số điện thoại người nhận.");
      return;
    }
    if (!addressLine.trim()) {
      setSubmitError("Vui lòng nhập địa chỉ nhận hàng.");
      return;
    }
    if (!quote || quote.items.length === 0) {
      setSubmitError("Chưa có thông tin báo giá sản phẩm hợp lệ.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const orderBody: OrderRequest = {
      recipient: {
        name: recipientName.trim(),
        phone: recipientPhone.trim(),
        address_line: addressLine.trim(),
        province: province.trim() || "Chưa chọn",
        ward: ward.trim() || "Chưa chọn",
      },
      note: note.trim() || null,
      voucher_code: appliedVoucher,
      expected_discount: quote.discount_total,
      expected_total: quote.total,
      items: quote.items.map((item) => ({
        sku: item.sku,
        warehouse_id: item.warehouse_id,
        quantity: item.quantity,
        expected_unit_price: item.unit_price,
      })),
    };

    const idempotencyKey = crypto.randomUUID();

    try {
      const receipt = await createOrder(orderBody, idempotencyKey);
      setOrderReceipt(receipt);
      shop.completeOrder(
        shop.selectedLines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
        shop.customer?.customer_id || ""
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Không thể tạo đơn hàng. Vui lòng kiểm tra lại kết nối và thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // If order successfully placed, show Confirmation screen
  if (orderReceipt) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.success} style={{ padding: "32px 24px", borderRadius: 8, marginTop: 40 }}>
            <h1 style={{ color: "#187b34", fontSize: 28, margin: "0 0 12px" }}>
              🎉 Đặt đơn hàng thành công!
            </h1>
            <p style={{ fontSize: 16, margin: "0 0 8px" }}>
              Mã đơn hàng của bạn: <strong>{orderReceipt.id}</strong>
            </p>
            <p style={{ color: "#555", fontSize: 14, margin: "0 0 20px" }}>
              Tổng tiền thanh toán: <strong>{money(orderReceipt.total, orderReceipt.currency)}</strong>
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href={`/main/orders/${encodeURIComponent(orderReceipt.id)}`}
                style={{
                  padding: "10px 22px",
                  background: "#0156ff",
                  color: "#fff",
                  borderRadius: 20,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Xem chi tiết đơn & Hóa đơn →
              </Link>
              <Link
                href="/main/profile"
                style={{
                  padding: "10px 22px",
                  border: "2px solid #0156ff",
                  color: "#0156ff",
                  borderRadius: 20,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Vào trang cá nhân
              </Link>
              <Link
                href="/main/product"
                style={{
                  padding: "10px 22px",
                  border: "2px solid #ccc",
                  color: "#333",
                  borderRadius: 20,
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // If no items selected
  if (shop.selectedLines.length === 0) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb}>
            <Link href="/">Trang chủ</Link>
            <span>›</span>
            <Link href="/cart">Giỏ hàng</Link>
            <span>›</span>
            <Link href="/checkout">Thanh toán</Link>
          </nav>
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <h2>Chưa có sản phẩm nào được chọn</h2>
            <p style={{ color: "#777", marginTop: 8 }}>
              Vui lòng quay lại giỏ hàng và chọn các sản phẩm bạn muốn đặt mua.
            </p>
            <Link
              href="/cart"
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 24px",
                background: "#0156ff",
                color: "#fff",
                borderRadius: 20,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Quay lại giỏ hàng
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb}>
          <Link href="/">Trang chủ</Link>
          <span>›</span>
          <Link href="/cart">Giỏ hàng</Link>
          <span>›</span>
          <Link href="/checkout">Thanh toán</Link>
        </nav>

        <div className={styles.headingRow}>
          <h1>Thanh toán & Đặt hàng</h1>
          {shop.authStatus === "guest" && (
            <Link href="/auth/login?redirect=/checkout" className={styles.signIn}>
              Đăng nhập tài khoản
            </Link>
          )}
        </div>

        {submitError && (
          <div
            style={{
              padding: "12px 18px",
              background: "#ffebee",
              color: "#c62828",
              borderRadius: 6,
              marginBottom: 20,
              fontSize: 14,
            }}
          >
            ⚠️ {submitError}
          </div>
        )}

        <div className={styles.layout}>
          <div className={styles.checkoutMain}>
            <form className={styles.form} onSubmit={handlePlaceOrder}>
              <h2>1. Thông tin giao hàng</h2>

              <label>
                Họ và tên người nhận <em>*</em>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </label>

              <label>
                Số điện thoại liên hệ <em>*</em>
                <input
                  type="tel"
                  required
                  maxLength={20}
                  placeholder="Ví dụ: 0912345678"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                />
              </label>

              <label>
                Địa chỉ chi tiết (Số nhà, đường) <em>*</em>
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder="Ví dụ: 123 Đường Nguyễn Trãi"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 520 }}>
                <label style={{ width: "100%" }}>
                  Phường / Xã
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ví dụ: Phường 2"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                  />
                </label>
                <label style={{ width: "100%" }}>
                  Tỉnh / Thành phố
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ví dụ: TP. Hồ Chí Minh"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                  />
                </label>
              </div>

              <label>
                Ghi chú đơn hàng (nếu có)
                <input
                  type="text"
                  maxLength={250}
                  placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>

              <div className={styles.shippingMethods}>
                <fieldset>
                  <legend>2. Phương thức thanh toán</legend>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
                    <input type="radio" name="payment_method" defaultChecked />
                    <span>Thanh toán khi nhận hàng (COD)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
                    <input type="radio" name="payment_method" />
                    <span>Chuyển khoản ngân hàng (Qua mã QR / Tài khoản)</span>
                  </label>
                </fieldset>
              </div>

              <div style={{ marginTop: 24 }}>
                <button
                  type="submit"
                  className={styles.placeOrder}
                  disabled={submitting || quoteLoading || !quote}
                  style={{ width: "100%", maxWidth: 300, fontSize: 16 }}
                >
                  {submitting ? "Đang xử lý đặt hàng..." : "Xác nhận đặt hàng"}
                </button>
              </div>
            </form>
          </div>

          <aside className={styles.summary}>
            <h2>Đơn hàng của bạn</h2>
            <div className={styles.summaryHead}>
              <span>{shop.selectedLines.length} sản phẩm</span>
              <Link href="/cart" style={{ color: "#0156ff", textDecoration: "none" }}>
                Sửa giỏ hàng
              </Link>
            </div>

            <div>
              {shop.selectedLines.map((line) => {
                const unitPrice = parseFloat(line.unit_price || "0");
                const formattedPrice = new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: line.currency || "VND",
                }).format(unitPrice * line.quantity);

                return (
                  <article key={line.sku}>
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
                      <p>{line.name || line.sku}</p>
                      <small>SL: {line.quantity}</small>
                      <strong>{formattedPrice}</strong>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Voucher input form */}
            <div style={{ margin: "20px 0", padding: "16px 0", borderTop: "1px solid #cacdd8" }}>
              <form onSubmit={handleApplyVoucher} style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Mã giảm giá (Voucher)"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  style={{
                    flex: 1,
                    height: 38,
                    padding: "0 10px",
                    border: "1px solid #a2a6b0",
                    borderRadius: 4,
                    fontSize: 13,
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "0 14px",
                    background: "#0156ff",
                    color: "#fff",
                    border: 0,
                    borderRadius: 4,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Áp dụng
                </button>
              </form>
              {appliedVoucher && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "#187b34", fontWeight: 600 }}>
                    ✓ Đã áp dụng mã: {appliedVoucher}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveVoucher}
                    style={{
                      border: 0,
                      background: "transparent",
                      color: "#c62828",
                      fontSize: 12,
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    Bỏ mã
                  </button>
                </div>
              )}
            </div>

            {/* Totals overview */}
            <div className={styles.summaryTotals}>
              {quoteLoading ? (
                <p style={{ textAlign: "center", color: "#666" }}>Đang tính toán giá đơn hàng...</p>
              ) : quoteError ? (
                <p style={{ color: "#c62828", fontSize: 13 }}>⚠️ {quoteError}</p>
              ) : quote ? (
                <>
                  <p>
                    <span>Tiền hàng</span>
                    <strong>{money(quote.subtotal, quote.currency)}</strong>
                  </p>
                  {parseFloat(quote.discount_total) > 0 && (
                    <p style={{ color: "#187b34" }}>
                      <span>Giảm giá voucher</span>
                      <strong>−{money(quote.discount_total, quote.currency)}</strong>
                    </p>
                  )}
                  <p>
                    <span>Thuế VAT dự kiến (10%)</span>
                    <span>{money(quote.tax_total, quote.currency)}</span>
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>
                    <span>Tổng thanh toán</span>
                    <strong style={{ color: "#0156ff" }}>{money(quote.total, quote.currency)}</strong>
                  </p>
                </>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
