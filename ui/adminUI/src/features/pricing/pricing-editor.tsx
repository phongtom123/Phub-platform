"use client";
import { useEffect, useState } from "react";
import { pricingRequest, pricingMoney, type PriceInputs, type PricePreview, type TaxRule, type ReceiptPriceQuote } from "../../../../shared/pricing";
import styles from "./pricing.module.css";

export function PriceRules({ rate, taxes, onChange, disabled = false }: {
  rate: string; taxes: TaxRule[]; disabled?: boolean;
  onChange: (value: { markup_rate: string; taxes: TaxRule[] }) => void;
}) {
  function updateTax(index: number, patch: Partial<TaxRule>) {
    onChange({ markup_rate: rate, taxes: taxes.map((tax, i) => i === index ? { ...tax, ...patch } : tax) });
  }
  return <div className={styles.rules}>
    <label>Tỷ lệ cộng lãi (%)<input type="text" inputMode="decimal" value={rate} disabled={disabled}
      onChange={event => onChange({ markup_rate: event.target.value, taxes })} /></label>
    <div><strong>Thuế của dòng phiếu nhập</strong>{taxes.map((tax, index) => <div className={styles.tax} key={index}>
      <label>Mã thuế<input value={tax.code} maxLength={30} disabled={disabled} onChange={event => updateTax(index, { code: event.target.value.toUpperCase() })} /></label>
      <label>Tên thuế<input value={tax.name ?? tax.code} maxLength={100} disabled={disabled} onChange={event => updateTax(index, { name: event.target.value })} /></label>
      <label>Tỷ lệ thuế (%)<input type="text" inputMode="decimal" value={tax.rate} disabled={disabled} onChange={event => updateTax(index, { rate: event.target.value })} /></label>
      <button type="button" disabled={disabled} onClick={() => onChange({ markup_rate: rate, taxes: taxes.filter((_, i) => i !== index) })}>Bỏ thuế {tax.code}</button>
    </div>)}
      <button type="button" disabled={disabled || taxes.length >= 20} onClick={() => {
        let number = 1;
        while (taxes.some(tax => tax.code === `TAX_${number}`)) number++;
        onChange({ markup_rate: rate, taxes: [...taxes, { code: `TAX_${number}`, name: "Thuế", rate: "0" }] });
      }}>+ Thêm thuế</button>
      {!taxes.length && <p>Không áp dụng thuế. Có thể nhập tên và tỷ lệ ngay trên phiếu.</p>}
    </div>
  </div>;
}

export function ReceiptPricing({ sku, cost, value, onChange, disabled = false }: { sku: string; cost: string; value?: PriceInputs; onChange: (value: PriceInputs) => void; disabled?: boolean }) {
  const [refresh, setRefresh] = useState(0);
  const identity = JSON.stringify([sku, cost, value ?? {}, refresh]);
  const [result, setResult] = useState<{ identity: string; sku: string; value: PricePreview } | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sku || !cost) return;
    const controller = new AbortController(); setError(""); setLoading(true);
    const timer = setTimeout(() => {
      pricingRequest<PricePreview>("preview", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku, unit_cost: cost, ...value }) })
        .then(value => { if (!controller.signal.aborted) setResult({ identity, sku, value }); })
        .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [identity]);
  const current = result?.identity === identity && sku && cost ? result.value : null;
  const context = result?.sku === sku ? result.value.context : null;
  return <section className={styles.card} aria-label={`Định giá ${sku || "sản phẩm"}`}>
    <h4>Giá bán dự kiến {sku}</h4><button type="button" disabled={disabled || !sku || !cost} onClick={() => setRefresh(v => v + 1)}>Tính lại giá dự kiến</button>
    {context && <PriceRules rate={value?.markup_rate ?? context.markup_rate} taxes={value?.taxes ?? context.taxes} disabled={disabled} onChange={onChange} />}
    {!sku || !cost ? <p>Chọn SKU và nhập giá nhập để xem giá do backend tính.</p> : error ? <p className="live-error" role="alert">{error}</p> : loading || !current ? <p role="status">Đang tính tại backend…</p> : <>
      <dl className={styles.result}><div><dt>Tiền lợi nhuận</dt><dd>{pricingMoney(current.profit)}</dd></div><div><dt>Giá bán trước thuế</dt><dd>{pricingMoney(current.pre_tax)}</dd></div>
        {current.taxes.map(tax => <div key={tax.code}><dt>{tax.name} ({tax.rate}%)</dt><dd>{pricingMoney(tax.amount)}</dd></div>)}<div><dt>Giá bán sau thuế</dt><dd><strong>{pricingMoney(current.after_tax)}</strong></dd></div></dl>
      {current.price_changed && <p className={styles.warning}>Giá đang bán trước thuế: {pricingMoney(current.current_price)}. Chỉ cập nhật khi xác nhận nhập kho.</p>}
      <small>Markup kiểm tra lại từ giá sau làm tròn: {current.actual_markup ?? "Không xác định"}{current.actual_markup != null ? "%" : ""}. Biên lợi nhuận tham khảo: {current.margin ?? "Không xác định"}{current.margin != null ? "%" : ""}. Hai tỷ lệ không thay thế nhau.</small>
    </>}
    <small>Phiếu chỉ lưu giá nhập, tỷ lệ lợi nhuận và tên/tỷ lệ thuế. Các số tiền được tính khi xem.</small>
  </section>;
}

export function ReceiptPricingSummary({ receiptId, status }: { receiptId: number; status: string }) {
  const [quote, setQuote] = useState<ReceiptPriceQuote | null>(null), [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); setError(""); setQuote(null); pricingRequest<ReceiptPriceQuote>(`receipts/${receiptId}`, { signal: controller.signal }).then(setQuote).catch(reason => { if (!controller.signal.aborted) setError(reason.message); }); return () => controller.abort(); }, [receiptId, status]);
  return <section className={styles.card} aria-label="Định giá theo dữ liệu phiếu nhập">
    <h3>Giá bán theo phiếu nhập</h3>
    {error && <p className="live-error" role="alert">{error}</p>}
    {!quote && !error && <p role="status">Đang tải định giá…</p>}
    {quote?.status === "DA_NHAP" && !quote.applied && <p className={styles.warning}>Phiếu được xác nhận bằng luồng cũ; chưa ghi nhận cập nhật giá bán tự động theo định giá mới.</p>}
    {quote?.lines.map(line => <div key={line.sku}><strong>{line.sku}</strong>{line.price ? <>
      <p>Giá nhập {pricingMoney(line.price.unit_cost)} · Markup {line.price.markup_rate}% · Tiền lợi nhuận {pricingMoney(line.price.profit)}</p>
      <p>Trước thuế {pricingMoney(line.price.pre_tax)} · Sau thuế {pricingMoney(line.price.after_tax)}</p>
      <p>{line.price.taxes.map(tax => `${tax.name} ${tax.rate}%: ${pricingMoney(tax.amount)}`).join("; ") || "Không áp dụng thuế"}</p>
    </> : <p>Phiếu cũ chưa ghi tỷ lệ lợi nhuận và thuế; không tự suy đoán.</p>}</div>)}
  </section>;
}
