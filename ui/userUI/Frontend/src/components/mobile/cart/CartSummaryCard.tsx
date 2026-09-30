"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cartPage1Data } from "./cartData";
import styles from "./CartPage1.module.css";

interface CartSummaryCardProps {
  subtotal: number;
  itemCount: number;
}

export function CartSummaryCard({ subtotal, itemCount }: CartSummaryCardProps) {
  const router = useRouter();
  // Khối Summary có thể bấm để thu gọn / kéo mở toàn bộ thẻ Rectangle
  const [isExpanded, setIsExpanded] = useState(true);
  const [shippingOpen, setShippingOpen] = useState(true);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "pickup">("standard");
  const [discountCode, setDiscountCode] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);

  const shippingCost = itemCount > 0 && shippingMethod === "standard" ? 21 : 0;
  const tax = itemCount > 0 ? 1.91 : 0;
  const gst = itemCount > 0 ? 1.91 : 0;
  const discountAmount = discountApplied ? Math.min(subtotal * 0.1, 100) : 0;
  const orderTotal = Math.max(0, subtotal + shippingCost + tax + gst - discountAmount);

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function handleApplyDiscount() {
    if (discountCode.trim().toUpperCase() === "TECH10") {
      setDiscountApplied(true);
    } else {
      setDiscountApplied(false);
    }
  }

  return (
    <section className={styles.summaryCard} aria-label="Tóm tắt đơn hàng">
      {/* Thanh bấm Summary để kéo mở / thu gọn Rectangle */}
      <button
        type="button"
        className={styles.summaryHeader}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <h2 className={styles.summaryHeaderTitle}>{cartPage1Data.summaryTitle}</h2>
        <div className={styles.summaryHeaderSummary}>
          {!isExpanded && (
            <span className={styles.summaryMiniTotal}>{formatCurrency(orderTotal)}</span>
          )}
          <span
            className={[styles.summaryArrow, isExpanded && styles.summaryArrowRotated]
              .filter(Boolean)
              .join(" ")}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Khối Rectangle nội dung chi tiết */}
      {isExpanded && (
        <div className={styles.summaryRectangle}>
          {/* Estimate Shipping and Tax */}
          <div className={styles.accordionSection}>
            <button
              type="button"
              className={styles.accordionButton}
              onClick={() => setShippingOpen(!shippingOpen)}
              aria-expanded={shippingOpen}
            >
              <span>{cartPage1Data.estimateShippingTitle}</span>
              <span className={[styles.chevron, shippingOpen && styles.chevronUp].filter(Boolean).join(" ")}>
                ▲
              </span>
            </button>
            {shippingOpen && (
              <div className={styles.accordionBody}>
                <p style={{ margin: "0 0 10px 0" }}>{cartPage1Data.estimateShippingDesc}</p>
                <div className={styles.shippingRadioGroup}>
                  {cartPage1Data.shippingOptions.map(opt => {
                    const isSelected = shippingMethod === opt.id;
                    return (
                      <label key={opt.id} className={styles.radioOption}>
                        <span
                          className={styles.customRadio}
                          onClick={() => setShippingMethod(opt.id as "standard" | "pickup")}
                        >
                          {isSelected && <span className={styles.customRadioInner} />}
                        </span>
                        <div className={styles.radioLabel}>
                          <strong>
                            {opt.name} - {formatCurrency(opt.cost)}
                          </strong>
                          <div className={styles.radioSubtext}>{opt.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Apply Discount Code */}
          <div className={styles.accordionSection}>
            <button
              type="button"
              className={styles.accordionButton}
              onClick={() => setDiscountOpen(!discountOpen)}
              aria-expanded={discountOpen}
            >
              <span>{cartPage1Data.applyDiscountTitle}</span>
              <span className={[styles.chevron, discountOpen && styles.chevronUp].filter(Boolean).join(" ")}>
                ▲
              </span>
            </button>
            {discountOpen && (
              <div className={styles.accordionBody}>
                <div className={styles.discountRow}>
                  <input
                    type="text"
                    className={styles.discountInput}
                    placeholder={cartPage1Data.discountPlaceholder}
                    value={discountCode}
                    onChange={e => setDiscountCode(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.discountBtn}
                    onClick={handleApplyDiscount}
                  >
                    {cartPage1Data.applyDiscountBtn}
                  </button>
                </div>
                {discountApplied && (
                  <p className={styles.discountMessage}>Đã áp dụng mã giảm giá TECH10 thành công!</p>
                )}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {/* Bảng tính chi phí */}
          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>{cartPage1Data.labels.subtotal}</span>
            <span className={styles.breakdownValue}>{formatCurrency(subtotal)}</span>
          </div>

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>{cartPage1Data.labels.shipping}</span>
            <span className={styles.breakdownValue}>{formatCurrency(shippingCost)}</span>
          </div>
          <p className={styles.shippingNote}>{cartPage1Data.labels.shippingNote}</p>

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>{cartPage1Data.labels.tax}</span>
            <span className={styles.breakdownValue}>{formatCurrency(tax)}</span>
          </div>

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>{cartPage1Data.labels.gst}</span>
            <span className={styles.breakdownValue}>{formatCurrency(gst)}</span>
          </div>

          {discountApplied && (
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>Giảm giá</span>
              <span className={styles.breakdownValue} style={{ color: "#187b34" }}>
                -{formatCurrency(discountAmount)}
              </span>
            </div>
          )}

          <div className={styles.orderTotalRow}>
            <span>{cartPage1Data.labels.orderTotal}</span>
            <span className={styles.orderTotalAmount}>{formatCurrency(orderTotal)}</span>
          </div>

          {/* 3 nút hành động Checkout */}
          <button
            type="button"
            className={styles.checkoutBtn}
            onClick={() => router.push("/checkout")}
            disabled={itemCount === 0}
          >
            {cartPage1Data.labels.proceedCheckout}
          </button>

          <button
            type="button"
            className={styles.paypalBtn}
            onClick={() => router.push("/checkout")}
            disabled={itemCount === 0}
          >
            <span>{cartPage1Data.labels.paypalCheckout}</span>
            <svg width="60" height="18" viewBox="0 0 100 28" fill="none" aria-hidden="true">
              <path
                d="M12.2 3.5H3.6C3.1 3.5 2.7 3.9 2.6 4.4L0 20.8C0 21.1 0.2 21.4 0.5 21.4H4.6C5.1 21.4 5.5 21 5.6 20.5L6.6 14.1C6.7 13.6 7.1 13.2 7.6 13.2H9.8C14.1 13.2 16.9 11.1 17.5 6.9C17.8 5 17.2 3.5 12.2 3.5Z"
                fill="#002E82"
              />
              <path
                d="M27.2 9.5H23.1C22.6 9.5 22.2 9.9 22.1 10.4L20.8 18.6L20.4 21C20.3 21.3 20.5 21.6 20.8 21.6H24.5C25 21.6 25.4 21.2 25.5 20.7L26.3 15.6C26.4 15.1 26.8 14.7 27.3 14.7H28.7C32.1 14.7 34.3 13 34.8 9.7C35 8.2 34.6 7 30.6 7L27.2 9.5Z"
                fill="#0079C1"
              />
            </svg>
          </button>

          <button
            type="button"
            className={styles.multipleAddressesBtn}
            onClick={() => router.push("/checkout")}
            disabled={itemCount === 0}
          >
            {cartPage1Data.labels.multipleAddresses}
          </button>

          {/* Banner Zip */}
          <div className={styles.zipContainer}>
            <Image src="/images/home/zip.svg" alt="Zip" width={52} height={22} />
            <span>
              {cartPage1Data.labels.zipText}{" "}
              <a href="#zip" className={styles.zipLink}>
                {cartPage1Data.labels.zipLearnMore}
              </a>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
