"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PackagePlus, Save, Trash2, Truck } from "lucide-react";
import { operationKey, warehouseApi, WarehouseApiError } from "@/src/lib/warehouse-api";
import LookupSelect from "./lookup-select";
import type { Receipt, ReceiptLine } from "./types";
import { WarehousePricePreview } from "./receipt-pricing";

type EditableLine = ReceiptLine & { quantityInput: string };

export default function ReceiptForm({ id }: { id?: number }) {
  const router = useRouter();
  const [record, setRecord] = useState<Receipt | null>(null);
  const [supplier, setSupplier] = useState<{ id: number; name: string } | null>(null);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [loading, setLoading] = useState(id !== undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
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
  const totalQuantity = lines.reduce((sum, line) => sum + (Number(line.quantityInput) || 0), 0);
  const totalValue = lines.reduce((sum, line) => sum + (Number(line.quantityInput) || 0) * (Number(line.unit_price) || 0), 0);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (blocked) return; setError(""); setConflict(false);
    if (!supplier || !lines.length) { setError("Chọn nhà cung cấp và ít nhất một sản phẩm."); return; }
    if (lines.some(line => !/^[1-9]\d*$/.test(line.quantityInput) || Number(line.quantityInput) > 1000000 || !/^\d{1,16}(\.\d{1,2})?$/.test(line.unit_price))) {
      setError("Số lượng phải từ 1 đến 1.000.000; giá nhập không âm và tối đa hai chữ số thập phân."); return;
    }
    const body = JSON.stringify({ supplier_id: supplier.id, note: note.trim() || null, lines: lines.map(line => ({ sku: line.sku, quantity: Number(line.quantityInput), unit_price: line.unit_price })), ...(record ? { expected_version: record.version } : {}) });
    pending.current = operationKey(pending.current, body); setSaving(true);
    try {
      const saved = await warehouseApi<Receipt>(`warehouse/receipts${id !== undefined ? `/${id}` : ""}`, { method: id !== undefined ? "PATCH" : "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key }, body });
      router.replace(`/receipts/${saved.receipt.ma_phieu_nhap}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không lưu được phiếu."); setConflict(reason instanceof WarehouseApiError && reason.status === 409); }
    finally { setSaving(false); }
  }

  function addProduct(row: Record<string, string | number | null>) {
    if (lines.some(line => line.sku === row.sku)) { setError("Sản phẩm đã có trong phiếu. Hãy sửa số lượng ở dòng tương ứng."); return; }
    setError(""); setLines(current => [...current, { sku: String(row.sku), product_name: String(row.ten_sp), quantity: 1, quantityInput: "1", unit_price: "0", unit: String(row.don_vi ?? "") }]);
  }

  return <section className="warehouse-workspace receipt-form-workspace">
    <nav className="warehouse-breadcrumb"><Link href="/">Tổng quan</Link><span>›</span><Link href="/receipts">Phiếu nhập</Link>{id !== undefined && <><span>›</span><Link href={`/receipts/${id}`}>{record?.receipt.ma_phieu_code ?? id}</Link></>}<span>›</span><strong>{id !== undefined ? "Chỉnh sửa" : "Tạo mới"}</strong></nav>
    <div className="receipt-form-hero"><div><span className="receipt-eyebrow"><Truck size={14}/> NGHIỆP VỤ KHO</span><h1>{id !== undefined ? "Chỉnh sửa phiếu nhập" : "Tạo phiếu nhập"}</h1><p>Kiểm tra nhà cung cấp và hàng thực nhận trước khi lưu phiếu nháp.</p></div><Link className="button" href={id !== undefined ? `/receipts/${id}` : "/receipts"}><ArrowLeft size={15}/> Quay lại</Link></div>
    {loading && <p role="status" className="warehouse-info">Đang tải dữ liệu phiếu nhập…</p>}
    {record && record.receipt.trang_thai !== "NHAP" && <p className="warehouse-error">Phiếu đã xử lý, không thể chỉnh sửa.</p>}
    <form onSubmit={save} className="receipt-form-card"><fieldset disabled={blocked} className="warehouse-fields">
      <div className="receipt-section-heading"><span className="receipt-step">01</span><div><h2>Thông tin nhập hàng</h2><p>Chọn nhà cung cấp và ghi chú cho lần nhập này.</p></div></div>
      <LookupSelect resource="suppliers" label="Nhà cung cấp" onSelect={row => setSupplier({ id: Number(row.ma_ncc), name: String(row.ten_ncc) })} />
      <p className="warehouse-selection"><span>Nhà cung cấp đã chọn</span><strong>{supplier?.name ?? "Chưa chọn nhà cung cấp"}</strong></p>
      <label className="warehouse-field"><span>Ghi chú giao nhận <small>(không bắt buộc)</small></span><textarea maxLength={2000} rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Ví dụ: Nhập đủ số lượng theo hóa đơn nhà cung cấp…" /></label>
      <div className="receipt-section-heading product-heading"><span className="receipt-step">02</span><div><h2>Danh sách sản phẩm</h2><p>Thêm sản phẩm, sau đó nhập số lượng và giá nhập thực tế.</p></div></div>
      <LookupSelect resource="products" label="Thêm sản phẩm nhập" onSelect={addProduct} disabled={lines.length >= 100} />
      <div className="receipt-summary-strip"><span><PackagePlus size={16}/> {lines.length} SKU</span><span>{totalQuantity.toLocaleString("vi-VN")} sản phẩm</span><strong>{totalValue.toLocaleString("vi-VN")} ₫</strong></div>
      <div className="warehouse-table receipt-lines-table"><table><thead><tr><th>SẢN PHẨM / SKU</th><th>ĐƠN VỊ</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ NHẬP</th><th>THÀNH TIỀN</th><th /></tr></thead><tbody>{lines.map((line, index) => <tr key={line.sku}><td><strong>{line.product_name}</strong><small>{line.sku}</small></td><td>{line.unit}</td><td><input aria-label={`Số lượng ${line.sku}`} type="number" min={1} max={1000000} step={1} required value={line.quantityInput} onChange={event => setLines(current => current.map((item, i) => i === index ? { ...item, quantityInput: event.target.value } : item))} /></td><td><input aria-label={`Giá nhập ${line.sku}`} type="text" inputMode="decimal" required value={line.unit_price} onChange={event => setLines(current => current.map((item, i) => i === index ? { ...item, unit_price: event.target.value } : item))} /></td><td className="receipt-line-total">{((Number(line.quantityInput) || 0) * (Number(line.unit_price) || 0)).toLocaleString("vi-VN")} ₫</td><td><button className="icon-button receipt-remove" title="Bỏ sản phẩm" type="button" onClick={() => setLines(current => current.filter((_, i) => i !== index))}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!lines.length && <div className="warehouse-empty receipt-empty"><PackagePlus size={24}/><strong>Chưa có sản phẩm</strong><span>Dùng ô “Thêm sản phẩm nhập” phía trên để bắt đầu.</span></div>}</div>
      <div className="receipt-pricing-list">{lines.map(line => <WarehousePricePreview key={line.sku} sku={line.sku} cost={line.unit_price} receiptId={id} />)}</div>
      <div className="receipt-form-footer"><div><strong>Phiếu nháp</strong><span>Tồn kho chỉ tăng sau khi xác nhận nhập hàng.</span></div><div className="warehouse-toolbar"><Link className="button" href={id !== undefined ? `/receipts/${id}` : "/receipts"}>Hủy chỉnh sửa</Link><button className="button primary" disabled={!supplier || !lines.length}><Save size={15}/>{saving ? "Đang lưu…" : "Lưu phiếu nháp"}</button></div></div>
    </fieldset>{error && <p className="warehouse-error" role="alert">{error}</p>}{conflict && <button className="button" type="button" onClick={() => window.location.reload()}>Tải lại phiếu</button>}</form>
  </section>;
}
