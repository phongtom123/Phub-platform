"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Section = "receipts" | "transfers";
type Product = { sku: string; ten_sp: string };
type Line = { sku: string; quantity: string; unitPrice: string };
type Options = { warehouses: { ma_kho: number; ten_kho: string }[]; suppliers: { ma_ncc: number; ten_ncc: string }[]; products: Product[] };
type Detail = { header: Record<string, string | number | null>; lines: Record<string, string | number | null>[] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không thể xử lý nghiệp vụ kho.");
  return body as T;
}

export default function WarehouseWorkflowForm({ section, recordId }: { section: Section; recordId?: number }) {
  const router = useRouter();
  const receipt = section === "receipts";
  const editing = recordId !== undefined;
  const [options, setOptions] = useState<Options | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ sku: "", quantity: "1", unitPrice: "0" }]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [data, user, detail] = await Promise.all([
          api<Options>("warehouse/options"),
          api<{ warehouse_id: number | null }>("auth/me"),
          editing ? api<Detail>(`warehouse/${section}/${recordId}`) : Promise.resolve(null),
        ]);
        setOptions(data);
        const header = detail?.header;
        setWarehouseId(String(header?.[receipt ? "ma_kho" : "ma_kho_xuat"] ?? user.warehouse_id ?? data.warehouses[0]?.ma_kho ?? ""));
        setDestinationId(String(header?.ma_kho_nhan ?? data.warehouses.find(item => String(item.ma_kho) !== String(user.warehouse_id ?? ""))?.ma_kho ?? ""));
        setSupplierId(String(header?.ma_ncc ?? data.suppliers[0]?.ma_ncc ?? ""));
        setNote(String(header?.ghi_chu ?? ""));
        setLines(detail?.lines.length ? detail.lines.map(line => ({ sku: String(line.sku ?? ""), quantity: String(line[receipt ? "so_luong_nhap" : "so_luong"] ?? "1"), unitPrice: String(line.gia_nhap ?? "0") })) : [{ sku: data.products[0]?.sku ?? "", quantity: "1", unitPrice: "0" }]);
      } catch (err) { setError(err instanceof Error ? err.message : "Không tải được dữ liệu phiếu."); }
    })();
  }, [editing, receipt, recordId, section]);

  const updateLine = (index: number, field: keyof Line, value: string) => setLines(current => current.map((line, i) => i === index ? { ...line, [field]: value } : line));
  const addLine = () => setLines(current => [...current, { sku: options?.products[0]?.sku ?? "", quantity: "1", unitPrice: "0" }]);
  const removeLine = (index: number) => setLines(current => current.length === 1 ? current : current.filter((_, i) => i !== index));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const validLines = lines.map(line => ({ sku: line.sku, quantity: Number(line.quantity), ...(receipt ? { unit_price: line.unitPrice } : {}) }));
      const body = receipt ? { supplier_id: Number(supplierId), warehouse_id: Number(warehouseId), note: note || null, lines: validLines } : { source_warehouse_id: Number(warehouseId), destination_warehouse_id: Number(destinationId), note: note || null, lines: validLines.map(line => ({ sku: line.sku, quantity: line.quantity })) };
      await api(`warehouse/${section}/${editing ? `${recordId}/draft` : "draft"}`, { method: editing ? "PUT" : "POST", body: JSON.stringify(body) });
      router.push(`/${section}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể lưu phiếu."); }
    finally { setSaving(false); }
  }

  return <section className="form-panel">
    <div className="form-panel-head"><h2>{editing ? "Sửa phiếu nháp" : receipt ? "Tạo phiếu nhập nháp" : "Tạo phiếu chuyển kho nháp"}</h2><p>{editing ? "Chỉ phiếu ở trạng thái NHAP mới được sửa." : "Thông tin sẽ được ghi bằng transaction nghiệp vụ kho."}</p></div>
    {error && <p className="live-error" role="alert">{error}</p>}
    <form onSubmit={submit}><div className="form-grid">
      <label><span>{receipt ? "Kho nhập" : "Kho xuất"}</span><select required value={warehouseId} onChange={event => setWarehouseId(event.target.value)} disabled={!options || editing}><option value="">Chọn kho</option>{options?.warehouses.map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} (#{item.ma_kho})</option>)}</select></label>
      {receipt ? <label><span>Nhà cung cấp</span><select required value={supplierId} onChange={event => setSupplierId(event.target.value)} disabled={!options}><option value="">Chọn nhà cung cấp</option>{options?.suppliers.map(item => <option key={item.ma_ncc} value={item.ma_ncc}>{item.ten_ncc}</option>)}</select></label> : <label><span>Kho nhận</span><select required value={destinationId} onChange={event => setDestinationId(event.target.value)} disabled={!options}><option value="">Chọn kho nhận</option>{options?.warehouses.filter(item => String(item.ma_kho) !== warehouseId).map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} (#{item.ma_kho})</option>)}</select></label>}
      <label className="wide"><span>Sản phẩm và số lượng</span><div className="workflow-lines">{lines.map((line, index) => <div className="workflow-line" key={index}><select required value={line.sku} onChange={event => updateLine(index, "sku", event.target.value)} disabled={!options}><option value="">Chọn SKU</option>{options?.products.map(item => <option key={item.sku} value={item.sku}>{item.sku} · {item.ten_sp}</option>)}</select><input required min="1" type="number" value={line.quantity} onChange={event => updateLine(index, "quantity", event.target.value)} placeholder="Số lượng" />{receipt && <input required min="0" step="0.01" type="number" value={line.unitPrice} onChange={event => updateLine(index, "unitPrice", event.target.value)} placeholder="Đơn giá" />}<button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1}>Xóa</button></div>)}</div><button type="button" className="button" onClick={addLine}>+ Thêm sản phẩm</button></label>
      <label className="wide"><span>Ghi chú</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Ghi chú nếu có" /></label>
    </div><div className="form-actions"><button type="button" className="button" onClick={() => router.push(`/${section}`)}>Hủy</button><button className="button primary" disabled={saving || !options}>{saving ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Lưu phiếu nháp"}</button></div></form>
  </section>;
}
