"use client";
import { useEffect, useState } from "react";
import { pricingRequest, pricingMoney, type PricingContext, type PriceInputs, type PricePreview, type TaxRule, type ReceiptPriceQuote } from "../../../../shared/pricing";
import styles from "./pricing.module.css";

export function PriceRules({ rate, taxes, catalog, onChange, disabled = false }: {
  rate: string; taxes: TaxRule[]; catalog: PricingContext["catalog"]; disabled?: boolean;
  onChange: (value: { markup_rate: string; taxes: TaxRule[] }) => void;
}) {
  const emit = (value: { markup_rate: string; taxes: TaxRule[] }) => onChange({ markup_rate: value.markup_rate, taxes: value.taxes.map(tax => ({ code: tax.code, rate: tax.rate })) });
  return <div className={styles.rules}>
    <label>Tỷ lệ cộng lãi (markup, %)<input type="text" inputMode="decimal" value={rate} disabled={disabled} onChange={event => emit({ markup_rate: event.target.value, taxes })} /></label>
    <div><strong>Các loại thuế trên cùng giá trước thuế</strong>{taxes.map((tax, index) => <div className={styles.tax} key={tax.code}>
      <span>{catalog.find(item => item.code === tax.code)?.name ?? tax.code}</span>
      <label>Tỷ lệ {tax.code} (%)<input type="text" inputMode="decimal" value={tax.rate} disabled={disabled} onChange={event => emit({ markup_rate: rate, taxes: taxes.map((item, i) => i === index ? { ...item, rate: event.target.value } : item) })} /></label>
      <button type="button" disabled={disabled} onClick={() => emit({ markup_rate: rate, taxes: taxes.filter((_, i) => i !== index) })}>Bỏ thuế {tax.code}</button>
    </div>)}
      <select aria-label="Thêm loại thuế" value="" disabled={disabled || taxes.length >= 20} onChange={event => {
        const item = catalog.find(item => item.code === event.target.value);
        if (item) emit({ markup_rate: rate, taxes: [...taxes, { code: item.code, rate: item.rate }] });
      }}><option value="">+ Thêm loại thuế</option>{catalog.filter(item => item.active && !taxes.some(tax => tax.code === item.code)).map(item => <option key={item.code} value={item.code}>{item.name} ({item.code})</option>)}</select>
      {!taxes.length && <p>Không áp dụng thuế.</p>}
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
    <h4>Giá bán dự kiến {sku}</h4><button type="button" disabled={disabled || !sku || !cost} onClick={() => setRefresh(v => v + 1)}>Tải lại cấu hình định giá</button>
    {context && <PriceRules rate={value?.markup_rate ?? context.markup_rate} taxes={value?.taxes ?? context.taxes} catalog={context.catalog} disabled={disabled} onChange={onChange} />}
    {!sku || !cost ? <p>Chọn SKU và nhập giá nhập để xem giá do backend tính.</p> : error ? <p className="live-error" role="alert">{error}</p> : loading || !current ? <p role="status">Đang tính tại backend…</p> : <>
      <dl className={styles.result}><div><dt>Tiền lợi nhuận</dt><dd>{pricingMoney(current.profit)}</dd></div><div><dt>Giá bán trước thuế</dt><dd>{pricingMoney(current.pre_tax)}</dd></div>
        {current.taxes.map(tax => <div key={tax.code}><dt>{tax.name} ({tax.rate}%)</dt><dd>{pricingMoney(tax.amount)}</dd></div>)}<div><dt>Giá bán sau thuế</dt><dd><strong>{pricingMoney(current.after_tax)}</strong></dd></div></dl>
      {current.price_changed && <p className={styles.warning}>Giá đang bán trước thuế: {pricingMoney(current.current_price)}. Chỉ cập nhật khi xác nhận nhập kho.</p>}
      <small>Markup kiểm tra lại từ giá sau làm tròn: {current.actual_markup ?? "Không xác định"}{current.actual_markup != null ? "%" : ""}. Biên lợi nhuận tham khảo: {current.margin ?? "Không xác định"}{current.margin != null ? "%" : ""}. Hai tỷ lệ không thay thế nhau.</small>
    </>}
    <small>Backend tính Decimal: lãi = giá nhập × markup; thuế tính riêng trên giá trước thuế. Làm tròn HALF_UP đến 1 đồng ở từng bước; UI không tự tính số tiền.</small>
  </section>;
}

export function PricingSettings({ sku }: { sku?: string }) {
  const [context, setContext] = useState<PricingContext | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const [rate, setRate] = useState(""), [taxes, setTaxes] = useState<TaxRule[]>([]), [inheritRate, setInheritRate] = useState(false), [inheritTaxes, setInheritTaxes] = useState(false);
  const [taxCode, setTaxCode] = useState(""), [taxName, setTaxName] = useState(""), [taxRate, setTaxRate] = useState("0");
  const path = "config" + (sku ? "?" + new URLSearchParams({ sku }) : "");
  function accept(next: PricingContext) { setContext(next); setRate(next.markup_rate); setTaxes(next.taxes); setInheritRate(next.inherited_markup); setInheritTaxes(next.inherited_taxes); }
  useEffect(() => { const controller = new AbortController(); setContext(null); setError(""); pricingRequest<PricingContext>(path, { signal: controller.signal }).then(accept).catch(reason => { if (!controller.signal.aborted) setError(reason.message); }); return () => controller.abort(); }, [path]);
  async function save() {
    if (!context || busy) return; setBusy(true); setError(""); setNotice("");
    try { accept(await pricingRequest<PricingContext>(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markup_rate: sku && inheritRate ? null : rate, taxes: sku && inheritTaxes ? null : taxes.map(tax => ({ code: tax.code, rate: tax.rate })), expected_version: context.version }) })); setNotice("Đã lưu cấu hình. Không thay đổi giá đang bán hoặc phiếu đã xác nhận."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không lưu được cấu hình."); } finally { setBusy(false); }
  }
  async function addTax() {
    setBusy(true); setError(""); setNotice("");
    try { await pricingRequest("taxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: taxCode, name: taxName, rate: taxRate }) }); accept(await pricingRequest<PricingContext>(path)); setTaxCode(""); setTaxName(""); setNotice("Đã tạo loại thuế; chọn vào danh sách rồi lưu cấu hình để áp dụng."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không tạo được thuế."); } finally { setBusy(false); }
  }
  return <section className={styles.card} aria-label="Cấu hình markup và thuế"><h3>{sku ? "Cấu hình giá của sản phẩm" : "Mặc định markup và thuế hệ thống"}</h3>
    {error && <p className="live-error" role="alert">{error}</p>}{notice && <p className="live-note" role="status">{notice}</p>}
    {!context ? <p>Đang tải cấu hình…</p> : <>
      {sku && <div className={styles.controls}><label><input type="checkbox" checked={inheritRate} disabled={busy} onChange={event => setInheritRate(event.target.checked)} />Dùng markup hệ thống</label><label><input type="checkbox" checked={inheritTaxes} disabled={busy} onChange={event => setInheritTaxes(event.target.checked)} />Dùng thuế hệ thống</label></div>}
      <PriceRules rate={rate} taxes={taxes} catalog={context.catalog} disabled={busy} onChange={value => { if (sku && value.markup_rate !== rate) setInheritRate(false); if (sku && JSON.stringify(value.taxes) !== JSON.stringify(taxes.map(tax => ({ code: tax.code, rate: tax.rate })))) setInheritTaxes(false); setRate(value.markup_rate); setTaxes(value.taxes); setNotice(""); }} />
      <button type="button" className="live-primary" disabled={busy} onClick={() => void save()}>Lưu cấu hình giá</button>
      <details><summary>Thêm loại thuế vào danh mục</summary><div className={styles.controls}><label>Mã thuế<input value={taxCode} maxLength={30} disabled={busy} onChange={event => setTaxCode(event.target.value.toUpperCase())} /></label><label>Tên thuế<input value={taxName} maxLength={100} disabled={busy} onChange={event => setTaxName(event.target.value)} /></label><label>Tỷ lệ mặc định (%)<input value={taxRate} disabled={busy} onChange={event => setTaxRate(event.target.value)} /></label><button type="button" disabled={busy || !taxCode || !taxName} onClick={() => void addTax()}>Tạo loại thuế</button></div></details>
      <details><summary>Lịch sử thay đổi cấu hình ({context.history.length} gần nhất)</summary>{context.history.map((entry, index) => <div key={index}><strong>{entry.actor ?? "Chưa ghi người sửa"} · {new Date(entry.changed_at).toLocaleString("vi-VN")}</strong><pre className={styles.audit}>{JSON.stringify({ before: entry.before_value, after: entry.after_value }, null, 2)}</pre></div>)}</details>
    </>}
  </section>;
}

export function ReceiptPricingSummary({ receiptId, status }: { receiptId: number; status: string }) {
  const [quote, setQuote] = useState<ReceiptPriceQuote | null>(null), [error, setError] = useState("");
  useEffect(() => { const controller = new AbortController(); setError(""); setQuote(null); pricingRequest<ReceiptPriceQuote>(`receipts/${receiptId}`, { signal: controller.signal }).then(setQuote).catch(reason => { if (!controller.signal.aborted) setError(reason.message); }); return () => controller.abort(); }, [receiptId, status]);
  return <section className={styles.card} aria-label="Snapshot định giá phiếu nhập">
    <h3>Giá bán theo phiếu nhập</h3>
    {error && <p className="live-error" role="alert">{error}</p>}
    {!quote && !error && <p role="status">Đang tải định giá…</p>}
    {quote?.status === "DA_NHAP" && !quote.applied && <p className={styles.warning}>Phiếu được xác nhận bằng luồng cũ; chưa ghi nhận cập nhật giá bán tự động theo định giá mới.</p>}
    {quote?.lines.map(line => <div key={line.sku}><strong>{line.sku}</strong>{line.price ? <>
      <p>Giá nhập {pricingMoney(line.price.unit_cost)} · Markup {line.price.markup_rate}% · Tiền lợi nhuận {pricingMoney(line.price.profit)}</p>
      <p>Trước thuế {pricingMoney(line.price.pre_tax)} · Sau thuế {pricingMoney(line.price.after_tax)}</p>
      <p>{line.price.taxes.map(tax => `${tax.name} ${tax.rate}%: ${pricingMoney(tax.amount)}`).join("; ") || "Không áp dụng thuế"}</p>
      <small>Người sửa: {line.changed_by ?? "Chưa ghi nhận"} · {line.changed_at ? new Date(line.changed_at).toLocaleString("vi-VN") : "Phiếu cũ"}</small>
    </> : <p>Phiếu cũ chưa có snapshot định giá; không suy đoán từ cấu hình hiện tại.</p>}</div>)}
  </section>;
}
