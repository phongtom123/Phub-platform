"use client";

import { useEffect, useState } from "react";
import { getQuote } from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import type { Quote } from "@/lib/shopping/types";
import { TaxNotice } from "@/components/common/Price";
import { useShopping } from "./ShoppingProvider";
import styles from "./shopping.module.css";

export function useCheckoutQuote(voucher: string | null) {
  const shop = useShopping();
  const signature = JSON.stringify(
    shop.selectedLines
      .map(({ sku, quantity }) => ({ sku, quantity }))
      .sort((a, b) => a.sku.localeCompare(b.sku)),
  );
  const blocked =
    shop.authStatus !== "authenticated" ||
    shop.cartLoading ||
    !shop.selectedLines.length ||
    shop.selectedLines.some((line) => line.unavailable);
  const identity = shop.customer?.customer_id;
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([identity, signature, voucher, revision]);
  const [result, setResult] = useState<{
    key: string;
    error: string;
    quote: Quote | null;
  } | null>(null);
  useEffect(() => {
    if (blocked) return;
    const controller = new AbortController();
    getQuote(JSON.parse(signature), voucher, controller.signal)
      .then((quote) => {
        if (!controller.signal.aborted) {
          setResult({ key, error: "", quote });
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setResult({
            key,
            quote: null,
            error:
              reason instanceof Error
                ? reason.message
                : "Không thể kiểm tra giỏ hàng.",
          });
        }
      });
    return () => controller.abort();
  }, [key, signature, voucher, blocked]);
  const current = !blocked && result?.key === key ? result : null;
  const quote = current?.quote || null;
  const error = current?.error || "";
  return {
    quote,
    error,
    loading: !blocked && !quote && !error,
    reload: () => {
      setResult(null);
      setRevision((value) => value + 1);
    },
  };
}

export function QuoteTotals({ quote }: { quote: Quote }) {
  return (
    <div className={styles.totals}>
      <p>
        <span>Tiền sản phẩm</span>
        <strong>{money(quote.subtotal, quote.currency)}</strong>
      </p>
      <p>
        <span>
          Giảm giá{quote.voucher_code ? ` (${quote.voucher_code})` : ""}
        </span>
        <strong>−{money(quote.discount_total, quote.currency)}</strong>
      </p>
      <p>
        <span>Thuế tại bước đặt đơn</span>
        <span>{money(quote.tax_total, quote.currency)}</span>
      </p>
      <p className={styles.total}>
        <span>Tổng tiền trước thuế</span>
        <strong>{money(quote.total, quote.currency)}</strong>
      </p>
      <TaxNotice />
      <small>
        Thuế 10% được áp dụng khi tạo hóa đơn. Phí vận chuyển sẽ được xác nhận
        riêng.
      </small>
    </div>
  );
}

export function VoucherForm({
  value,
  onApply,
  disabled = false,
}: {
  value: string | null;
  onApply: (code: string | null) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value || "");
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft.trim().toUpperCase() || null);
      }}
    >
      <label>
        Mã voucher
        <input
          name="voucher"
          value={draft}
          maxLength={100}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <div className={styles.inline}>
        <button type="submit" disabled={disabled}>
          Áp dụng voucher
        </button>
        {value && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setDraft("");
              onApply(null);
            }}
          >
            Bỏ voucher
          </button>
        )}
      </div>
    </form>
  );
}
