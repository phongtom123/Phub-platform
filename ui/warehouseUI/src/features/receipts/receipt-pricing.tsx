"use client";
import { useEffect, useState } from "react";
import { pricingRequest, pricingMoney, type Price, type PricePreview } from "../../../../shared/pricing";

export function PriceBreakdown({ price, sku }: { price: Price | null; sku: string }) {
  return <section className="receiving-card" aria-label={`Giá bán dự kiến ${sku}`}><h3>Định giá {sku}</h3>{!price ? <p>Phiếu cũ chưa có snapshot giá. Không tự suy đoán giá theo cấu hình mới.</p> : <>
    <p>Markup: <strong>{price.markup_rate}%</strong> (chỉ ADMIN được sửa)</p>
    <dl className="warehouse-details"><div><dt>Tiền lợi nhuận</dt><dd>{pricingMoney(price.profit)}</dd></div><div><dt>Giá bán trước thuế</dt><dd>{pricingMoney(price.pre_tax)}</dd></div>
      {price.taxes.map(tax => <div key={tax.code}><dt>{tax.name} ({tax.rate}%)</dt><dd>{pricingMoney(tax.amount)}</dd></div>)}<div><dt>Giá bán sau thuế</dt><dd><strong>{pricingMoney(price.after_tax)}</strong></dd></div></dl>
    {price.changed_by && <p>Người sửa: {price.changed_by} · {price.changed_at ? new Date(price.changed_at).toLocaleString("vi-VN") : ""}</p>}
    <small>UI chỉ hiển thị kết quả backend. Từng khoản thuế tính trên cùng giá trước thuế; làm tròn HALF_UP đến 1 đồng. Markup không phải biên lợi nhuận.</small>
  </>}</section>;
}

export function WarehousePricePreview({ sku, cost, receiptId }: { sku: string; cost: string; receiptId?: number }) {
  const identity = JSON.stringify([sku, cost, receiptId]);
  const [result, setResult] = useState<{ identity: string; price: PricePreview } | null>(null), [error, setError] = useState("");
  useEffect(() => {
    if (!sku || !cost) return;
    const controller = new AbortController(); setError("");
    const timer = setTimeout(() => {
      pricingRequest<PricePreview>("preview", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku, unit_cost: cost, ...(receiptId !== undefined ? { receipt_id: receiptId } : {}) }) })
        .then(price => { if (!controller.signal.aborted) setResult({ identity, price }); })
        .catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [identity]);
  if (!cost) return <p>Nhập giá nhập để xem định giá từ backend.</p>;
  if (error) return <p className="warehouse-error" role="alert">{error}</p>;
  if (result?.identity !== identity) return <p role="status">Đang lấy giá dự kiến từ backend…</p>;
  return <><PriceBreakdown price={result.price} sku={sku} />{result.price.price_changed && <p className="warehouse-error">Giá đang bán trước thuế: {pricingMoney(result.price.current_price)}. Xác nhận nhập mới áp dụng giá đề xuất.</p>}</>;
}
