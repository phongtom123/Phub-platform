"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { operationKey, warehouseApi, WarehouseApiError } from "@/src/lib/warehouse-api";
import LookupSelect from "./lookup-select";
import type { Receipt, ReceiptLine } from "./types";
import { WarehousePricePreview } from "./receipt-pricing";

type EditableLine = ReceiptLine & { quantityInput: string };
export default function ReceiptForm({ id }: { id?: number }) {
  const router = useRouter(); const [record, setRecord] = useState<Receipt | null>(null);
  const [supplier, setSupplier] = useState<{ id: number; name: string } | null>(null);
  const [note, setNote] = useState(""); const [lines, setLines] = useState<EditableLine[]>([]);
  const [loading, setLoading] = useState(id !== undefined); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [conflict, setConflict] = useState(false);
  const pending = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    if (id === undefined) return;
    const controller = new AbortController();
    warehouseApi<Receipt>(`warehouse/receipts/${id}`, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      setRecord(data); setSupplier({ id: data.receipt.ma_ncc, name: data.receipt.supplier_name }); setNote(data.receipt.ghi_chu ?? "");
      setLines(data.lines.map(line => ({ ...line, quantityInput: String(line.quantity) })));
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);
  const blocked = saving || loading || conflict || (id !== undefined && (!record || record.receipt.trang_thai !== "NHAP"));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (blocked) return; setError(""); setConflict(false);
    if (!supplier || !lines.length) { setError("Chọn nhà cung cấp và ít nhất một sản phẩm."); return; }
    if (lines.some(line => !/^[1-9]\d*$/.test(line.quantityInput) || Number(line.quantityInput) > 1000000 || !/^\d{1,16}(\.\d{1,2})?$/.test(line.unit_price))) {
      setError("Số lượng phải là số nguyên từ 1 đến 1.000.000; giá nhập không âm và tối đa hai chữ số thập phân."); return;
    }
    const body = JSON.stringify({ supplier_id: supplier.id, note: note.trim() || null,
      lines: lines.map(line => ({ sku: line.sku, quantity: Number(line.quantityInput), unit_price: line.unit_price })),
      ...(record ? { expected_version: record.version } : {}) });
    pending.current = operationKey(pending.current, body); setSaving(true);
    try {
      const saved = await warehouseApi<Receipt>(`warehouse/receipts${id !== undefined ? `/${id}` : ""}`, {
        method: id !== undefined ? "PATCH" : "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key }, body,
      });
      router.replace(`/receipts/${saved.receipt.ma_phieu_nhap}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không lưu được phiếu."); setConflict(reason instanceof WarehouseApiError && reason.status === 409); }
    finally { setSaving(false); }
  }
  return <section className="warehouse-workspace">
    <nav className="warehouse-breadcrumb"><Link href="/">Tổng quan</Link><span>›</span><Link href="/receipts">Phiếu nhập</Link>{id !== undefined && <><span>›</span><Link href={`/receipts/${id}`}>{record?.receipt.ma_phieu_code ?? id}</Link></>}<span>›</span><strong>{id !== undefined ? "Chỉnh sửa" : "Tạo phiếu"}</strong></nav>
    <Link className="button" href={id !== undefined ? `/receipts/${id}` : "/receipts"}>← Quay lại</Link>
    <div className="page-heading"><div><h1>{id !== undefined ? "Chỉnh sửa phiếu nhập" : "Tạo phiếu nhập"}</h1><p>Phiếu mới ở trạng thái nháp. Tồn kho chỉ tăng khi xác nhận nhập hàng.</p></div></div>
    {loading && <p role="status">Đang tải phiếu…</p>}
    {record && record.receipt.trang_thai !== "NHAP" && <p className="warehouse-error">Phiếu đã xử lý, không thể chỉnh sửa.</p>}
    <form onSubmit={save} className="receiving-card"><fieldset disabled={blocked} className="warehouse-fields">
      <LookupSelect resource="suppliers" label="Nhà cung cấp" onSelect={row => setSupplier({ id: Number(row.ma_ncc), name: String(row.ten_ncc) })} />
      <p className="warehouse-selection">Nhà cung cấp đã chọn: <strong>{supplier?.name ?? "Chưa chọn"}</strong></p>
      <label className="warehouse-field">Ghi chú<textarea maxLength={2000} rows={3} value={note} onChange={event => setNote(event.target.value)} /></label>
      <LookupSelect resource="products" label="Sản phẩm nhập" onSelect={row => {
        if (lines.some(line => line.sku === row.sku)) { setError("Sản phẩm đã có trong phiếu. Hãy sửa số lượng ở dòng tương ứng."); return; }
        setError(""); setLines(current => [...current, { sku: String(row.sku), product_name: String(row.ten_sp), quantity: 1, quantityInput: "1", unit_price: "0", unit: String(row.don_vi ?? "") }]);
      }} disabled={lines.length >= 100} />
      <div className="warehouse-table"><table><thead><tr><th>Sản phẩm / SKU</th><th>Đơn vị</th><th>Số lượng</th><th>Đơn giá nhập (₫)</th><th /></tr></thead><tbody>{lines.map((line, index) => <tr key={line.sku}>
        <td><strong>{line.product_name}</strong><small>{line.sku}</small></td><td>{line.unit}</td>
        <td><input aria-label={`Số lượng ${line.sku}`} type="number" min={1} max={1000000} step={1} required value={line.quantityInput} onChange={event => setLines(current => current.map((item, i) => i === index ? { ...item, quantityInput: event.target.value } : item))} /></td>
        <td><input aria-label={`Giá nhập ${line.sku}`} type="text" inputMode="decimal" required value={line.unit_price} onChange={event => setLines(current => current.map((item, i) => i === index ? { ...item, unit_price: event.target.value } : item))} /></td>
        <td><button className="button" type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Bỏ dòng</button></td>
      </tr>)}</tbody></table>{!lines.length && <p className="warehouse-empty">Chọn sản phẩm phía trên để thêm vào phiếu.</p>}</div>
      {lines.map(line => <WarehousePricePreview key={line.sku} sku={line.sku} cost={line.unit_price} receiptId={id} />)}
      <div className="warehouse-toolbar"><button className="button primary" disabled={!supplier || !lines.length}>{saving ? "Đang lưu…" : "Lưu phiếu nháp"}</button><Link className="button" href={id !== undefined ? `/receipts/${id}` : "/receipts"}>Hủy chỉnh sửa</Link></div>
    </fieldset>{error && <p className="warehouse-error" role="alert">{error}</p>}{conflict && <button className="button" type="button" onClick={() => window.location.reload()}>Tải lại phiếu</button>}</form>
  </section>;
}
