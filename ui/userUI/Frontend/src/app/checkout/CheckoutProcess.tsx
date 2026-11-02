"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import { PaymentPanel } from "@/components/shopping/PaymentPanel";
import { InvoicePanel } from "@/components/shopping/InvoicePanel";
import {
  createAddress,
  createOrder,
  deleteAddress,
  getQuote,
  listAddresses,
  ShoppingError,
  updateAddress,
} from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import type { AddressBook, CustomerAddress, Quote, OrderRequest, Receipt } from "@/lib/shopping/types";
import styles from "./checkout.module.css";

// The address book used to live in localStorage; that stale copy of personal data is removed.
const LEGACY_ADDRESSES_KEY = "phub_user_delivery_addresses_v1";
const MAX_ADDRESSES = 10;
// The order note is one line: the database rejects control characters such as line breaks.
const MAX_NOTE_LENGTH = 500;
const PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function CheckoutProcess({}: { confirmation?: boolean } = {}) {
  const shop = useShopping();

  // Address book (database table DIA_CHI_KHACH_HANG via /api/customer/addresses)
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressList, setShowAddressList] = useState(false);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressReload, setAddressReload] = useState(0);
  const [savingAddress, setSavingAddress] = useState(false);

  // View mode: "order" (Trang đặt hàng) or "shipping_form" (Trang thông tin giao hàng)
  const [viewMode, setViewMode] = useState<"order" | "shipping_form">("shipping_form");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Shipping Form fields (the delivery note is NOT part of the address, see orderNote)
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formWard, setFormWard] = useState("");
  const [formProvince, setFormProvince] = useState("");
  const [formDefault, setFormDefault] = useState(false);
  const [formError, setFormError] = useState("");

  // Order & Payment states. The note belongs to this order only (DON_HANG.ghi_chu).
  const [orderNote, setOrderNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "bank_transfer">("cod");
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);

  // Quote & submission states
  const [quote, setQuote] = useState<Quote | null>(null);
  const effectiveQuote = shop.selectedLines.length === 0 ? null : quote;
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [orderReceipt, setOrderReceipt] = useState<Receipt | null>(null);
  const placingOrder = useRef(false);

  // Show the book returned by the server and keep the selection when it still exists.
  const applyAddressBook = (book: AddressBook, preferredId?: string | null) => {
    setAddresses(book.items);
    setSelectedAddressId((current) => {
      const wanted = preferredId ?? current;
      if (wanted && book.items.some((a) => a.id === wanted)) return wanted;
      return (book.items.find((a) => a.is_default) ?? book.items[0])?.id ?? null;
    });
  };

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_ADDRESSES_KEY);
    } catch {
      // storage unavailable
    }
  }, []);

  // 1. Load the address book from the database
  const customerId = shop.customer?.customer_id;
  const addressesLoading =
    shop.authStatus === "loading" || (shop.authStatus === "authenticated" && !addressesLoaded);
  useEffect(() => {
    if (shop.authStatus !== "authenticated") return;
    const controller = new AbortController();
    listAddresses(controller.signal)
      .then((book) => {
        if (controller.signal.aborted) return;
        applyAddressBook(book);
        // Đã có thông tin giao hàng -> mở thẳng trang Đặt hàng, chưa có -> mở form nhập
        setViewMode(book.items.length > 0 ? "order" : "shipping_form");
        setAddressesLoaded(true);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setAddressError(errorMessage(err, "Không thể tải thông tin giao hàng. Vui lòng thử lại."));
        setAddressesLoaded(true);
      });
    return () => controller.abort();
  }, [shop.authStatus, customerId, addressReload]);

  // Currently selected address
  const currentAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0] || null;

  // 2. Fetch quote whenever selected lines or applied voucher changes
  useEffect(() => {
    if (shop.selectedLines.length === 0) {
      return;
    }

    const items = shop.selectedLines.map((l) => ({
      sku: l.sku,
      quantity: l.quantity,
    }));

    const controller = new AbortController();
    queueMicrotask(() => {
      setQuoteLoading(true);
      setQuoteError("");
    });

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

  // Handle open shipping form for Add New (prefilled with the account name/phone)
  const handleOpenAddAddress = (first = addresses.length === 0) => {
    setEditingAddressId(null);
    setFormName(shop.customer?.name || "");
    setFormPhone(shop.customer?.phone || "");
    setFormAddress("");
    setFormWard("");
    setFormProvince("");
    setFormDefault(first);
    setFormError("");
    setViewMode("shipping_form");
  };

  // Handle open shipping form for Edit Existing
  const handleOpenEditAddress = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setFormName(addr.name);
    setFormPhone(addr.phone);
    setFormAddress(addr.address_line);
    setFormWard(addr.ward);
    setFormProvince(addr.province);
    setFormDefault(addr.is_default);
    setFormError("");
    setViewMode("shipping_form");
  };

  // Handle Delete Address (the server promotes another address when the default is deleted)
  const handleDeleteAddress = async (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (savingAddress || !window.confirm("Xóa thông tin giao hàng này?")) return;
    setSavingAddress(true);
    setAddressError("");
    try {
      const book = await deleteAddress(idToDelete);
      applyAddressBook(book);
      if (book.items.length === 0) handleOpenAddAddress(true);
    } catch (err) {
      setAddressError(errorMessage(err, "Không thể xóa thông tin giao hàng."));
    } finally {
      setSavingAddress(false);
    }
  };

  // 3. Handle Submit "Xác nhận" trên form Thông tin giao hàng: lưu vào database
  const handleConfirmShippingForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAddress) return;
    setFormError("");

    const input = {
      name: formName.trim(),
      phone: formPhone.trim(),
      address_line: formAddress.trim(),
      ward: formWard.trim(),
      province: formProvince.trim(),
      is_default: formDefault,
    };
    if (!input.name) {
      setFormError("Vui lòng nhập họ và tên người nhận.");
      return;
    }
    if (!PHONE_PATTERN.test(input.phone.replace(/[ ()-]/g, ""))) {
      setFormError("Số điện thoại phải gồm 8–15 chữ số.");
      return;
    }
    if (!input.address_line) {
      setFormError("Vui lòng nhập địa chỉ chi tiết nhận hàng.");
      return;
    }
    if (!input.ward || !input.province) {
      setFormError("Vui lòng nhập Phường / Xã và Tỉnh / Thành phố.");
      return;
    }

    setSavingAddress(true);
    try {
      const book = editingAddressId
        ? await updateAddress(editingAddressId, input)
        : await createAddress(input);
      // Địa chỉ vừa lưu được chọn cho đơn hàng đang đặt
      applyAddressBook(book, book.item?.id);
      setAddressError("");
      setShowAddressList(false);
      setViewMode("order");
    } catch (err) {
      setFormError(errorMessage(err, "Không thể lưu thông tin giao hàng. Vui lòng thử lại."));
    } finally {
      setSavingAddress(false);
    }
  };

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

  // 4. Handle "Đặt hàng" tại trang Đặt hàng
  const handlePlaceOrder = async () => {
    if (placingOrder.current) return;
    if (!currentAddress) {
      setSubmitError("Vui lòng nhập và chọn thông tin giao hàng trước khi đặt hàng.");
      setViewMode("shipping_form");
      return;
    }
    if (!effectiveQuote || effectiveQuote.items.length === 0) {
      setSubmitError("Chưa có thông tin báo giá sản phẩm hợp lệ.");
      return;
    }

    placingOrder.current = true;
    setSubmitting(true);
    setSubmitError("");

    const orderBody: OrderRequest = {
      recipient: {
        name: currentAddress.name,
        phone: currentAddress.phone,
        address_line: currentAddress.address_line,
        province: currentAddress.province,
        ward: currentAddress.ward,
      },
      note: orderNote.trim() || null,
      voucher_code: appliedVoucher,
      expected_discount: effectiveQuote.discount_total,
      expected_total: effectiveQuote.total,
      items: effectiveQuote.items.map((item) => ({
        sku: item.sku,
        warehouse_id: item.warehouse_id,
        quantity: item.quantity,
        expected_unit_price: item.unit_price,
      })),
    };

    const attemptStorageKey = `phub-checkout-attempt-v1:${shop.customer?.customer_id}`;
    try {
      const canonical = JSON.stringify({ ...orderBody, items: [...orderBody.items].sort((a, b) => a.sku.localeCompare(b.sku)) });
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
      const fingerprint = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
      // Persist only a key and hash; no delivery details or credentials are stored here.
      const previous = JSON.parse(sessionStorage.getItem(attemptStorageKey) || "null");
      if (previous && (previous.fingerprint !== fingerprint || typeof previous.key !== "string" ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(previous.key))) {
        throw new Error("Lần đặt trước chưa xác nhận kết quả. Hãy kiểm tra lịch sử đơn hàng trước khi đặt nội dung khác.");
      }
      const idempotencyKey = previous?.key || crypto.randomUUID();
      sessionStorage.setItem(attemptStorageKey, JSON.stringify({ key: idempotencyKey, fingerprint }));
      const receipt = await createOrder(orderBody, idempotencyKey);
      try { sessionStorage.removeItem(attemptStorageKey); } catch { /* The order has already succeeded. */ }
      try {
        sessionStorage.setItem(`phub-payment-choice-v1:${shop.customer?.customer_id}:${receipt.id}`,
          paymentMethod === "cod" ? "cash" : "bank_transfer");
      } catch { /* Order is already committed; storage failure must not report checkout failure. */ }
      setOrderReceipt(receipt);
      shop.completeOrder(
        shop.selectedLines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
        shop.customer?.customer_id || ""
      );
    } catch (err) {
      if (err instanceof ShoppingError && err.status >= 400 && err.status < 500 && ![408, 429].includes(err.status)) {
        try { sessionStorage.removeItem(attemptStorageKey); } catch { /* Keep the error visible. */ }
      }
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Không thể tạo đơn hàng. Vui lòng kiểm tra lại kết nối và thử lại."
      );
    } finally {
      placingOrder.current = false;
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
              Mã đơn hàng: <strong>{orderReceipt.id}</strong>
            </p>
            <p style={{ color: "#555", fontSize: 14, margin: "0 0 20px" }}>
              Tổng tiền hàng trước thuế: <strong>{money(orderReceipt.total, orderReceipt.currency)}</strong>
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
          <InvoicePanel orderId={orderReceipt.id} />
          {shop.customer?.payment_bypass_enabled && <PaymentPanel orderId={orderReceipt.id} />}
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
            <Link href="/checkout">Đặt hàng</Link>
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

  // Thông tin giao hàng gắn với tài khoản: khách chưa đăng nhập không đặt được hàng.
  if (shop.authStatus === "guest" || shop.authStatus === "unavailable") {
    const guest = shop.authStatus === "guest";
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb}>
            <Link href="/">Trang chủ</Link>
            <span>›</span>
            <Link href="/cart">Giỏ hàng</Link>
            <span>›</span>
            <strong>Đặt hàng</strong>
          </nav>
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <h2>{guest ? "Vui lòng đăng nhập để đặt hàng" : "Không thể xác minh tài khoản"}</h2>
            <p style={{ color: "#777", marginTop: 8 }}>
              {guest
                ? "Thông tin giao hàng được lưu trong tài khoản của bạn. Đăng nhập rồi quay lại để tiếp tục."
                : "Vui lòng tải lại trang hoặc thử lại sau."}
            </p>
            {guest && (
              <Link href="/auth/login?redirect=/checkout" className={styles.signIn}>
                Đăng nhập tài khoản
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (shop.authStatus === "loading" || addressesLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p style={{ padding: "60px 20px", textAlign: "center", color: "#666" }}>
            Đang tải thông tin giao hàng...
          </p>
        </div>
      </main>
    );
  }

  if (addressError && addresses.length === 0) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <p style={{ color: "#c62828" }}>⚠️ {addressError}</p>
            <button
              type="button"
              className={styles.placeOrder}
              style={{ width: 180, marginTop: 16 }}
              onClick={() => {
                setAddressError("");
                setAddressesLoaded(false);
                setAddressReload((n) => n + 1);
              }}
            >
              Thử lại
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // GIAO DIỆN 1: FORM "THÔNG TIN GIAO HÀNG"
  // (Không có phương thức thanh toán, không có cột bên phải, tiêu đề "Thông tin giao hàng", nút "Xác nhận")
  // ==========================================
  if (viewMode === "shipping_form") {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb}>
            <Link href="/">Trang chủ</Link>
            <span>›</span>
            <Link href="/cart">Giỏ hàng</Link>
            <span>›</span>
            <strong>Thông tin giao hàng</strong>
          </nav>

          <div className={styles.headingRow} style={{ minHeight: "auto", paddingBottom: 20 }}>
            <h1>Thông tin giao hàng</h1>
          </div>

          <div className={styles.singleFormContainer}>
            {formError && (
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
                ⚠️ {formError}
              </div>
            )}

            <form className={styles.form} onSubmit={handleConfirmShippingForm}>
              <h2>{editingAddressId ? "Chỉnh sửa thông tin giao hàng" : "Nhập thông tin giao hàng"}</h2>

              <label style={{ width: "100%" }}>
                Họ và tên người nhận <em>*</em>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </label>

              <label style={{ width: "100%" }}>
                Số điện thoại liên hệ <em>*</em>
                <input
                  type="tel"
                  required
                  maxLength={20}
                  placeholder="Ví dụ: 0912345678"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </label>

              <label style={{ width: "100%" }}>
                Địa chỉ chi tiết (Số nhà, tên đường) <em>*</em>
                <input
                  type="text"
                  required
                  maxLength={255}
                  placeholder="Ví dụ: 123 Đường Nguyễn Trãi"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ width: "100%" }}>
                  Phường / Xã <em>*</em>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Ví dụ: Phường 2"
                    value={formWard}
                    onChange={(e) => setFormWard(e.target.value)}
                  />
                </label>
                <label style={{ width: "100%" }}>
                  Tỉnh / Thành phố <em>*</em>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Ví dụ: TP. Hồ Chí Minh"
                    value={formProvince}
                    onChange={(e) => setFormProvince(e.target.value)}
                  />
                </label>
              </div>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={formDefault}
                  // The default address cannot be switched off directly: choose another one as default.
                  disabled={savingAddress || (editingAddressId !== null && addresses.find((a) => a.id === editingAddressId)?.is_default === true) || addresses.length === 0}
                  onChange={(e) => setFormDefault(e.target.checked)}
                />
                <span>Đặt làm địa chỉ mặc định</span>
              </label>

              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  type="submit"
                  className={styles.placeOrder}
                  style={{ width: 180, fontSize: 15 }}
                  disabled={savingAddress}
                >
                  {savingAddress ? "Đang lưu..." : "Xác nhận"}
                </button>

                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewMode("order")}
                    disabled={savingAddress}
                    style={{
                      height: 46,
                      padding: "0 22px",
                      background: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: 24,
                      fontSize: 14,
                      color: "#555",
                      cursor: "pointer",
                    }}
                  >
                    Hủy / Quay lại
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // GIAO DIỆN 2: TRANG "ĐẶT HÀNG"
  // (Chọn phương thức thanh toán, chọn/sửa/xóa/thêm địa chỉ giao hàng, tóm tắt đơn hàng bên phải)
  // ==========================================
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb}>
          <Link href="/">Trang chủ</Link>
          <span>›</span>
          <Link href="/cart">Giỏ hàng</Link>
          <span>›</span>
          <strong>Đặt hàng</strong>
        </nav>

        <div className={styles.headingRow}>
          <h1>Đặt hàng</h1>
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
            {/* 1. KHỐI THÔNG TIN GIAO HÀNG */}
            <div className={styles.addressBox}>
              <div className={styles.addressBoxHeader}>
                <h3>📍 Thông tin nhận hàng</h3>
                <button
                  type="button"
                  className={styles.changeAddressBtn}
                  onClick={() => setShowAddressList(!showAddressList)}
                >
                  {showAddressList ? "Đóng danh sách" : "Thay đổi thông tin giao hàng"}
                </button>
              </div>

              {addressError && (
                <div style={{ color: "#c62828", fontSize: 13, marginBottom: 8 }}>⚠️ {addressError}</div>
              )}

              {currentAddress ? (
                <div className={styles.addressDetails}>
                  <div>
                    <strong>{currentAddress.name}</strong> — <span>{currentAddress.phone}</span>
                  </div>
                  <div style={{ color: "#555", marginTop: 4 }}>
                    {[currentAddress.address_line, currentAddress.ward, currentAddress.province]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              ) : (
                <div style={{ color: "#c62828", fontSize: 14 }}>
                  Chưa có thông tin nhận hàng. Vui lòng thêm thông tin để tiếp tục.
                </div>
              )}

              {/* Danh sách địa chỉ mở rộng (có nút radio tròn bên trái, nút sửa, xóa, thêm) */}
              {showAddressList && (
                <div className={styles.addressList}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#444", margin: "4px 0 8px" }}>
                    Chọn một địa chỉ nhận hàng:
                  </p>

                  {addresses.map((addr) => {
                    const isSelected = addr.id === selectedAddressId;
                    return (
                      <div
                        key={addr.id}
                        className={`${styles.addressOption} ${
                          isSelected ? styles.addressOptionSelected : ""
                        }`}
                        onClick={() => setSelectedAddressId(addr.id)}
                      >
                        <input
                          type="radio"
                          name="selected_delivery_address"
                          className={styles.radioCircle}
                          checked={isSelected}
                          onChange={() => setSelectedAddressId(addr.id)}
                        />
                        <div className={styles.addressOptionContent}>
                          <div style={{ fontWeight: 600 }}>
                            {addr.name} — <span style={{ fontWeight: 400 }}>{addr.phone}</span>
                            {addr.is_default && <span className={styles.defaultBadge}>Mặc định</span>}
                          </div>
                          <div style={{ color: "#555" }}>
                            {[addr.address_line, addr.ward, addr.province].filter(Boolean).join(", ")}
                          </div>
                        </div>
                        <div className={styles.addressActions}>
                          <button
                            type="button"
                            className={styles.actionBtnText}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditAddress(addr);
                            }}
                          >
                            Chỉnh sửa
                          </button>
                          {addresses.length > 1 && (
                            <button
                              type="button"
                              className={`${styles.actionBtnText} ${styles.deleteBtnText}`}
                              onClick={(e) => handleDeleteAddress(addr.id, e)}
                              disabled={savingAddress}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    className={styles.addNewAddressBtn}
                    onClick={() => handleOpenAddAddress()}
                    disabled={savingAddress || addresses.length >= MAX_ADDRESSES}
                  >
                    + Thêm thông tin giao hàng mới
                  </button>
                  {addresses.length >= MAX_ADDRESSES && (
                    <small style={{ color: "#777" }}>Tối đa {MAX_ADDRESSES} địa chỉ. Hãy xóa bớt địa chỉ không dùng.</small>
                  )}
                </div>
              )}
            </div>

            {/* 2. KHỐI GHI CHÚ ĐƠN HÀNG: thuộc đơn đang đặt, lưu ở DON_HANG.ghi_chu */}
            <div className={styles.addressBox}>
              <div className={styles.addressBoxHeader}>
                <h3>📝 Ghi chú đơn hàng</h3>
                <small className={styles.noteCounter}>
                  {orderNote.length}/{MAX_NOTE_LENGTH}
                </small>
              </div>
              <input
                type="text"
                className={styles.orderNoteInput}
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                aria-label="Ghi chú đơn hàng"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value.replace(/[\u0000-\u001f\u007f]+/g, " "))}
              />
            </div>

            {/* 3. KHỐI PHƯƠNG THỨC THANH TOÁN */}
            <div className={styles.shippingMethods} style={{ borderTop: 0, marginTop: 0 }}>
              <fieldset>
                <legend style={{ fontSize: 16, marginBottom: 12 }}>💳 Phương thức thanh toán</legend>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    border: "1px solid #cdd5f0",
                    borderRadius: 6,
                    marginBottom: 10,
                    cursor: "pointer",
                    background: paymentMethod === "cod" ? "#f3f6ff" : "#fff",
                  }}
                >
                  <input
                    type="radio"
                    name="payment_choice"
                    className={styles.radioCircle}
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      Thanh toán khi nhận hàng (COD)
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      Thanh toán bằng tiền mặt khi shipper giao hàng đến nơi.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    border: "1px solid #cdd5f0",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: paymentMethod === "bank_transfer" ? "#f3f6ff" : "#fff",
                  }}
                >
                  <input
                    type="radio"
                    name="payment_choice"
                    className={styles.radioCircle}
                    checked={paymentMethod === "bank_transfer"}
                    onChange={() => setPaymentMethod("bank_transfer")}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      Chuyển khoản ngân hàng (Qua mã QR / Tài khoản)
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      Chuyển khoản qua tài khoản ngân hàng hoặc quét mã QR sau khi đặt đơn.
                    </div>
                  </div>
                </label>
              </fieldset>
            </div>
          </div>

          {/* 3. CỘT PHẢI: ĐƠN HÀNG CỦA BẠN & NÚT ĐẶT HÀNG */}
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
              ) : effectiveQuote ? (
                <>
                  <p>
                    <span>Tiền hàng</span>
                    <strong>{money(effectiveQuote.subtotal, effectiveQuote.currency)}</strong>
                  </p>
                  {parseFloat(effectiveQuote.discount_total) > 0 && (
                    <p style={{ color: "#187b34" }}>
                      <span>Giảm giá voucher</span>
                      <strong>−{money(effectiveQuote.discount_total, effectiveQuote.currency)}</strong>
                    </p>
                  )}
                  <p>
                    <span>Thuế VAT dự kiến (10%)</span>
                    <span>{money(effectiveQuote.tax_total, effectiveQuote.currency)}</span>
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>
                    <span>Tổng thanh toán</span>
                    <strong style={{ color: "#0156ff" }}>{money(effectiveQuote.total, effectiveQuote.currency)}</strong>
                  </p>
                </>
              ) : null}
            </div>

            {/* Nút đặt hàng */}
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                className={styles.placeOrder}
                disabled={submitting || savingAddress || quoteLoading || !effectiveQuote || !currentAddress}
                onClick={handlePlaceOrder}
                style={{ width: "100%", fontSize: 16, height: 48 }}
              >
                {submitting ? "Đang xử lý đặt hàng..." : "Đặt hàng"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
