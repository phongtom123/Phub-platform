"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useShopping } from "@/components/shopping/ShoppingProvider";
import { createOrder, getQuote, saveProfile } from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import type { Quote, OrderRequest, Receipt } from "@/lib/shopping/types";
import styles from "./checkout.module.css";

export interface DeliveryAddress {
  id: string;
  name: string;
  phone: string;
  address_line: string;
  ward: string;
  province: string;
  note?: string;
}

const ADDRESSES_STORAGE_KEY = "phub_user_delivery_addresses_v1";

export function CheckoutProcess({ confirmation = false }: { confirmation?: boolean }) {
  const router = useRouter();
  const shop = useShopping();

  // Address states
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressList, setShowAddressList] = useState(false);

  // View mode: "order" (Trang đặt hàng) or "shipping_form" (Trang thông tin giao hàng)
  const [viewMode, setViewMode] = useState<"order" | "shipping_form">("shipping_form");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  // Shipping Form fields
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formWard, setFormWard] = useState("");
  const [formProvince, setFormProvince] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formError, setFormError] = useState("");

  // Order & Payment states
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "bank_transfer">("cod");
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);

  // Quote & submission states
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [orderReceipt, setOrderReceipt] = useState<Receipt | null>(null);

  // 1. Load addresses from localStorage and customer profile
  useEffect(() => {
    let saved: DeliveryAddress[] = [];
    try {
      const stored = localStorage.getItem(ADDRESSES_STORAGE_KEY);
      if (stored) saved = JSON.parse(stored);
    } catch {
      saved = [];
    }

    // If no saved address in localStorage but shop.customer has info, add customer profile address
    if (saved.length === 0 && shop.customer) {
      if (shop.customer.name && (shop.customer.phone || shop.customer.address_line)) {
        const defaultAddr: DeliveryAddress = {
          id: "addr_profile_" + (shop.customer.customer_id || "default"),
          name: shop.customer.name || "",
          phone: shop.customer.phone || "",
          address_line: shop.customer.address_line || "",
          ward: shop.customer.ward || "",
          province: shop.customer.province || "",
        };
        saved = [defaultAddr];
      }
    }

    setAddresses(saved);
    if (saved.length > 0) {
      setSelectedAddressId(saved[0].id);
      setViewMode("order"); // Đã có thông tin giao hàng -> mở thẳng trang Đặt hàng
    } else {
      setViewMode("shipping_form"); // Chưa có thông tin giao hàng -> mở form Thông tin giao hàng
    }
  }, [shop.customer]);

  // Persist addresses to localStorage
  const saveAddressesToStorage = (updated: DeliveryAddress[]) => {
    setAddresses(updated);
    try {
      localStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Currently selected address
  const currentAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0] || null;

  // 2. Fetch quote whenever selected lines or applied voucher changes
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

  // Handle open shipping form for Add New
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setFormName(shop.customer?.name || "");
    setFormPhone(shop.customer?.phone || "");
    setFormAddress("");
    setFormWard("");
    setFormProvince("");
    setFormNote("");
    setFormError("");
    setViewMode("shipping_form");
  };

  // Handle open shipping form for Edit Existing
  const handleOpenEditAddress = (addr: DeliveryAddress) => {
    setEditingAddressId(addr.id);
    setFormName(addr.name);
    setFormPhone(addr.phone);
    setFormAddress(addr.address_line);
    setFormWard(addr.ward);
    setFormProvince(addr.province);
    setFormNote(addr.note || "");
    setFormError("");
    setViewMode("shipping_form");
  };

  // Handle Delete Address
  const handleDeleteAddress = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = addresses.filter((a) => a.id !== idToDelete);
    saveAddressesToStorage(next);
    if (selectedAddressId === idToDelete) {
      setSelectedAddressId(next.length > 0 ? next[0].id : null);
    }
    if (next.length === 0) {
      handleOpenAddAddress();
    }
  };

  // 3. Handle Submit "Xác nhận" trên form Thông tin giao hàng
  const handleConfirmShippingForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Vui lòng nhập họ và tên người nhận.");
      return;
    }
    if (!formPhone.trim()) {
      setFormError("Vui lòng nhập số điện thoại người nhận.");
      return;
    }
    if (!formAddress.trim()) {
      setFormError("Vui lòng nhập địa chỉ chi tiết nhận hàng.");
      return;
    }

    const addrId = editingAddressId || "addr_" + Date.now();
    const newAddress: DeliveryAddress = {
      id: addrId,
      name: formName.trim(),
      phone: formPhone.trim(),
      address_line: formAddress.trim(),
      ward: formWard.trim() || "Chưa chọn",
      province: formProvince.trim() || "Chưa chọn",
      note: formNote.trim() || undefined,
    };

    let nextAddresses: DeliveryAddress[];
    if (editingAddressId) {
      nextAddresses = addresses.map((a) => (a.id === editingAddressId ? newAddress : a));
    } else {
      nextAddresses = [newAddress, ...addresses];
    }

    saveAddressesToStorage(nextAddresses);
    setSelectedAddressId(addrId);

    // Save profile to backend in background if customer is logged in
    if (shop.customer) {
      saveProfile({
        name: newAddress.name,
        phone: newAddress.phone,
        address_line: newAddress.address_line,
        ward: newAddress.ward,
        province: newAddress.province,
      }).catch(() => {
        // ignore background error
      });
    }

    // Chuyển sang trang đặt hàng ngay lập tức
    setShowAddressList(false);
    setViewMode("order");
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
    if (!currentAddress) {
      setSubmitError("Vui lòng nhập và chọn thông tin giao hàng trước khi đặt hàng.");
      setViewMode("shipping_form");
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
        name: currentAddress.name,
        phone: currentAddress.phone,
        address_line: currentAddress.address_line,
        province: currentAddress.province,
        ward: currentAddress.ward,
      },
      note: currentAddress.note || null,
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
              Mã đơn hàng: <strong>{orderReceipt.id}</strong>
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
            {shop.authStatus === "guest" && (
              <Link href="/auth/login?redirect=/checkout" className={styles.signIn}>
                Đăng nhập tài khoản
              </Link>
            )}
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
                  maxLength={200}
                  placeholder="Ví dụ: 123 Đường Nguyễn Trãi"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ width: "100%" }}>
                  Phường / Xã
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ví dụ: Phường 2"
                    value={formWard}
                    onChange={(e) => setFormWard(e.target.value)}
                  />
                </label>
                <label style={{ width: "100%" }}>
                  Tỉnh / Thành phố
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ví dụ: TP. Hồ Chí Minh"
                    value={formProvince}
                    onChange={(e) => setFormProvince(e.target.value)}
                  />
                </label>
              </div>

              <label style={{ width: "100%" }}>
                Ghi chú giao hàng (nếu có)
                <input
                  type="text"
                  maxLength={250}
                  placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                />
              </label>

              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button
                  type="submit"
                  className={styles.placeOrder}
                  style={{ width: 180, fontSize: 15 }}
                >
                  Xác nhận
                </button>

                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewMode("order")}
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
                  {currentAddress.note && (
                    <div style={{ color: "#777", fontSize: 13, marginTop: 4 }}>
                      Ghi chú: {currentAddress.note}
                    </div>
                  )}
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
                    onClick={handleOpenAddAddress}
                  >
                    + Thêm thông tin giao hàng mới
                  </button>
                </div>
              )}
            </div>

            {/* 2. KHỐI PHƯƠNG THỨC THANH TOÁN */}
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

            {/* Nút đặt hàng */}
            <div style={{ marginTop: 20 }}>
              <button
                type="button"
                className={styles.placeOrder}
                disabled={submitting || quoteLoading || !quote || !currentAddress}
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
