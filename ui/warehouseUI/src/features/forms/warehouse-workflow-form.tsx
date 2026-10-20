"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Section = "receipts" | "transfers";
type Option = { id: number; name: string };
type Product = { sku: string; ten_sp: string };

type Options = { warehouses: { ma_kho: number; ten_kho: string }[]; suppliers: { ma_ncc: number; ten_ncc: string }[]; products: Product[] };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không thể xử lý nghiệp vụ kho.");
  return body as T;
}

export default function WarehouseWorkflowForm({ section }: { section: Section }) {
  const router = useRouter();
  const receipt = section === "receipts";
  const [options, setOptions] = useState<Options | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api<Options>("warehouse/options"), api<{ warehouse_id: number | null }>("auth/me")])
      .then(([data, user]) => {
        setOptions(data);
        if (user.warehouse_id !== null) setWarehouseId(String(user.warehouse_id));
        else if (data.warehouses[0]) setWarehouseId(String(data.warehouses[0].ma_kho));
        if (data.warehouses[1]) setDestinationId(String(data.warehouses[1].ma_kho));
        if (data.suppliers[0]) setSupplierId(String(data.suppliers[0].ma_ncc));
        if (data.products[0]) setSku(data.products[0].sku);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const body = receipt
        ? { supplier_id: Number(supplierId), warehouse_id: Number(warehouseId), note: note || null, lines: [{ sku, quantity: Number(quantity), unit_price: unitPrice }] }
        : { source_warehouse_id: Number(warehouseId), destination_warehouse_id: Number(destinationId), note: note || null, lines: [{ sku, quantity: Number(quantity) }] };
      await api(`warehouse/${section}/draft`, { method: "POST", body: JSON.stringify(body) });
      router.push(`/${section}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể tạo phiếu nháp."); }
    finally { setSaving(false); }
  }

  return <section className="form-panel">
    <div className="form-panel-head"><h2>{receipt ? "Tạo phiếu nhập nháp" : "Tạo phiếu chuyển kho nháp"}</h2><p>Thông tin sẽ được ghi bằng transaction nghiệp vụ kho.</p></div>
    {error && <p className="live-error" role="alert">{error}</p>}
    <form onSubmit={submit}><div className="form-grid">
      <label><span>{receipt ? "Kho nhập" : "Kho xuất"}</span><select required value={warehouseId} onChange={event => setWarehouseId(event.target.value)} disabled={!options}><option value="">Chọn kho</option>{options?.warehouses.map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} (#{item.ma_kho})</option>)}</select></label>
      {receipt ? <label><span>Nhà cung cấp</span><select required value={supplierId} onChange={event => setSupplierId(event.target.value)} disabled={!options}><option value="">Chọn nhà cung cấp</option>{options?.suppliers.map(item => <option key={item.ma_ncc} value={item.ma_ncc}>{item.ten_ncc}</option>)}</select></label> : <label><span>Kho nhận</span><select required value={destinationId} onChange={event => setDestinationId(event.target.value)} disabled={!options}><option value="">Chọn kho nhận</option>{options?.warehouses.filter(item => String(item.ma_kho) !== warehouseId).map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} (#{item.ma_kho})</option>)}</select></label>}
      <label><span>Sản phẩm</span><select required value={sku} onChange={event => setSku(event.target.value)} disabled={!options}><option value="">Chọn SKU</option>{options?.products.map(item => <option key={item.sku} value={item.sku}>{item.sku} · {item.ten_sp}</option>)}</select></label>
      <label><span>Số lượng</span><input required min="1" type="number" value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      {receipt && <label><span>Đơn giá</span><input required min="0" step="0.01" type="number" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} /></label>}
      <label className="wide"><span>Ghi chú</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Ghi chú nếu có" /></label>
    </div><div className="form-actions"><button type="button" className="button" onClick={() => router.push(`/${section}`)}>Hủy</button><button className="button primary" disabled={saving || !options}>{saving ? "Đang lưu…" : "Lưu phiếu nháp"}</button></div></form>
  </section>;
}
