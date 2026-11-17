import type { CheckoutLine, CustomerVoucher } from "./types";
import { cents } from "./money";

export function voucherScopeLabel(category: string | null | undefined): string {
  return category === "L_LINHKIEN" ? "Linh kiện máy tính"
    : category === "L_DESKTOP" ? "Máy tính để bàn & PC Gaming" : "Tất cả sản phẩm";
}

/** Quotes provide category IDs; do not guess from names or cached catalog data. */
export function eligibleVoucherSubtotal(voucher: CustomerVoucher, subtotal: string, items?: CheckoutLine[]): bigint | null {
  if (!voucher.category_id) return cents(subtotal);
  if (!items || items.some(item => !item.category_id)) return null;
  return items.reduce((sum, item) => sum + (item.category_id === voucher.category_id ? cents(item.gross_total) : BigInt(0)), BigInt(0));
}

export function estimatedVoucherDiscount(voucher: CustomerVoucher, eligible: bigint): bigint {
  let value = voucher.discount_type === "PHAN_TRAM"
    ? (eligible * cents(voucher.discount_value) + BigInt(5000)) / BigInt(10000) : cents(voucher.discount_value);
  if (voucher.discount_type === "PHAN_TRAM" && voucher.maximum_discount !== null) {
    const cap = cents(voucher.maximum_discount);
    if (value > cap) value = cap;
  }
  return value > eligible ? eligible : value;
}

export function normalizeVoucherCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase() || null;
  if (!code || code.length > 100 || /[\u0000-\u001f\u007f]/.test(code)) return null;
  return code;
}
