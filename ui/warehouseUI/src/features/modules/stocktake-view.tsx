"use client";

import { useEffect, useState } from "react";

type Product = { sku: string; ten_sp: string };
type Stocktake = { ma_phieu_kiem: number; ma_phieu_code: string; ma_kho: number; ngay_tao: string; trang_thai: string; ghi_chu?: string | null };
type Line = { sku: string; counted_quantity: string };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api/backend/" + path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(typeof body?.detail === "string" ? body.detail : "Không thể thực hiện thao tác kiểm kê.");
  return body as T;
}

export default function StocktakeView() {
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Stocktake[]>([]);
  const [lines, setLines] = useState<Line[]>([{ sku: "", counted_quantity: "0" }]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [me, options, list] = await Promise.all([
        api<{ warehouse_id: number | null }>("auth/me"),
        api<{ products: Product[] }>("warehouse/options"),
        api<Stocktake[]>("warehouse/stocktakes"),
      ]);
      setWarehouseId(me.warehouse_id); setProducts(options.products); setRows(list);
    } catch (err) { setError(err instanceof Error ? err.message : "Không tải được dữ liệu kiểm kê."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const updateLine = (index: number, field: keyof Line, value: string) => setLines(current => current.map((line, i) => i === index ? { ...line, [field]: value } : line));
  const addLine = () => setLines(current => [...current, { sku: "", counted_quantity: "0" }]);
  const removeLine = (index: number) => setLines(current => current.length === 1 ? current : current.filter((_, i) => i !== index));

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    if (warehouseId === null) { setError("Tài khoản chưa được phân công kho."); return; }
    const validLines = lines.filter(line => line.sku).map(line => ({ sku: line.sku, counted_quantity: Number(line.counted_quantity) }));
    if (!validLines.length || validLines.some(line => !Number.isInteger(line.counted_quantity) || line.counted_quantity < 0)) { setError("Vui lòng chọn sản phẩm và nhập số lượng hợp lệ."); return; }
    setSaving(true); setError("");
    try {
      await api("warehouse/stocktakes/draft", { method: "POST", body: JSON.stringify({ warehouse_id: warehouseId, note: note || null, lines: validLines }) });
      setLines([{ sku: "", counted_quantity: "0" }]); setNote(""); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Không tạo được phiên kiểm kê."); }
    finally { setSaving(false); }
  }

  async function submit(id: number) {
    setSaving(true); setError("");
    try { await api(`warehouse/stocktakes/${id}/submit`, { method: "POST" }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Không gửi được phiên kiểm kê."); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading"><div><h1>Kiểm kê</h1><p>Tạo phiên kiểm kê, gửi duyệt và cập nhật tồn kho sau khi Admin phê duyệt.</p></div></div>
    {error && <p className="live-error" role="alert">{error}</p>}
    <section className="panel stocktake-panel">
      <div className="panel-head"><div><h2>Tạo phiên kiểm kê</h2><p>{warehouseId === null ? "Chưa được phân công kho" : `Kho #${warehouseId}`}</p></div></div>
      <form className="stocktake-form" onSubmit={createDraft}>
        {lines.map((line, index) => <div className="stocktake-line" key={index}>
          <select value={line.sku} onChange={event => updateLine(index, "sku", event.target.value)} required aria-label={`Sản phẩm ${index + 1}`}><option value="">Chọn sản phẩm</option>{products.map(product => <option key={product.sku} value={product.sku}>{product.sku} · {product.ten_sp}</option>)}</select>
          <input type="number" min="0" step="1" value={line.counted_quantity} onChange={event => updateLine(index, "counted_quantity", event.target.value)} required aria-label={`Số lượng thực tế ${index + 1}`} />
          <button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1}>Xóa dòng</button>
        </div>)}
        <button type="button" onClick={addLine}>+ Thêm sản phẩm</button>
        <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Ghi chú kiểm kê (nếu có)" rows={3} />
        <button className="live-primary" disabled={saving || loading}>{saving ? "Đang lưu…" : "Lưu phiên nháp"}</button>
      </form>
    </section>
    <section className="panel stocktake-panel"><div className="panel-head"><div><h2>Phiên kiểm kê</h2><p>Chỉ Admin mới có quyền duyệt và cập nhật tồn kho.</p></div><button type="button" onClick={() => void load()}>Làm mới</button></div>
      {loading ? <p className="live-note">Đang tải…</p> : <div className="live-table"><table><thead><tr><th>Mã phiên</th><th>Ngày tạo</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(row => <tr key={row.ma_phieu_kiem}><td>{row.ma_phieu_code}</td><td>{new Date(row.ngay_tao).toLocaleString("vi-VN")}</td><td>{row.trang_thai}</td><td>{row.trang_thai === "NHAP" && <button type="button" onClick={() => void submit(row.ma_phieu_kiem)} disabled={saving}>Gửi duyệt</button>}</td></tr>)}</tbody></table>{!rows.length && <p className="live-note">Chưa có phiên kiểm kê.</p>}</div>}
    </section>
  </>;
}
