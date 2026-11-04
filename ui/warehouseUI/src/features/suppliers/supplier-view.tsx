"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Check, Pencil, Search, Save, X } from "lucide-react";
import { Panel, StatusBadge, EmptyState } from "@/src/components/warehouse/ui";
import { createSupplier, deactivateSupplier, getSuppliers, updateSupplier, type SupplierRecord } from "@/src/models/warehouse-model";

type FormState = { ten_ncc: string; sdt: string; email: string; dia_chi: string };
const emptyForm: FormState = { ten_ncc: "", sdt: "", email: "", dia_chi: "" };

export default function SupplierView() {
  const [rows, setRows] = useState<SupplierRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { const result = await getSuppliers(); setRows(result.data); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể tải nhà cung cấp."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter(row => {
    const haystack = `${row.ten_ncc} ${row.sdt ?? ""} ${row.email ?? ""} ${row.dia_chi ?? ""}`.toLocaleLowerCase("vi");
    return haystack.includes(query.toLocaleLowerCase("vi")) && (status === "all" || (status === "active" ? row.trang_thai === 1 : row.trang_thai !== 1));
  }), [rows, query, status]);

  function startCreate() { setEditingId(null); setForm(emptyForm); setShowForm(true); setError(""); }
  function startEdit(row: SupplierRecord) { setEditingId(row.ma_ncc); setForm({ ten_ncc: row.ten_ncc, sdt: row.sdt ?? "", email: row.email ?? "", dia_chi: row.dia_chi ?? "" }); setShowForm(true); setError(""); }
  function closeForm() { if (!saving) { setShowForm(false); setEditingId(null); setForm(emptyForm); } }
  function updateField(field: keyof FormState, value: string) { setForm(current => ({ ...current, [field]: value })); }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const body = { ten_ncc: form.ten_ncc.trim(), sdt: form.sdt.trim() || undefined, email: form.email.trim() || undefined, dia_chi: form.dia_chi.trim() || undefined };
      if (!body.ten_ncc) throw new Error("Tên nhà cung cấp không được để trống.");
      if (editingId === null) await createSupplier(body); else await updateSupplier(editingId, body);
      closeForm(); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể lưu nhà cung cấp."); }
    finally { setSaving(false); }
  }

  async function deactivate(row: SupplierRecord) {
    if (!window.confirm(`Ngừng hoạt động nhà cung cấp “${row.ten_ncc}”?`)) return;
    setError("");
    try { await deactivateSupplier(row.ma_ncc); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể ngừng hoạt động nhà cung cấp."); }
  }

  return <><div className="page-heading"><div><h1>Nhà cung cấp</h1><p>Tra cứu đối tác phục vụ quy trình nhập hàng.</p></div></div>
    <Panel title={`Danh sách nhà cung cấp (${filtered.length})`} subtitle="Nhà cung cấp ngừng hoạt động được giữ lại để bảo toàn lịch sử phiếu nhập." action={<div className="module-actions"><button className="button" onClick={() => void load()}>Làm mới</button></div>}>
      <div className="table-toolbar"><label className="search-box"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, email, số điện thoại..." aria-label="Tìm nhà cung cấp"/></label><label className="filter-select-wrap"><select className="filter-select" aria-label="Trạng thái nhà cung cấp" value={status} onChange={event => setStatus(event.target.value)}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="all">Tất cả</option></select></label></div>
      {error && <div className="module-note">{error}</div>}{loading ? <div className="module-note">Đang tải nhà cung cấp…</div> : filtered.length === 0 ? <EmptyState text="Không tìm thấy nhà cung cấp phù hợp."/> : <div className="table-wrap"><table><thead><tr><th>MÃ</th><th>TÊN NHÀ CUNG CẤP</th><th>LIÊN HỆ</th><th>ĐỊA CHỈ</th><th>TRẠNG THÁI</th><th/></tr></thead><tbody>{filtered.map(row => <tr key={row.ma_ncc}><td>NCC-{row.ma_ncc}</td><td className="strong-value">{row.ten_ncc}</td><td>{[row.sdt, row.email].filter(Boolean).join(" · ") || "—"}</td><td>{row.dia_chi || "—"}</td><td><StatusBadge value={row.trang_thai === 1 ? "Đang hoạt động" : "Ngừng hoạt động"}/></td><td className="row-actions"><button className="row-link" type="button" onClick={() => startEdit(row)} aria-label={`Sửa ${row.ten_ncc}`} title="Sửa"><Pencil size={15}/></button>{row.trang_thai === 1 && <button className="row-link" type="button" onClick={() => void deactivate(row)} aria-label={`Ngừng hoạt động ${row.ten_ncc}`} title="Ngừng hoạt động"><Ban size={15}/></button>}</td></tr>)}</tbody></table></div>}
    </Panel>
    {showForm && <div className="supplier-dialog-backdrop" role="presentation"><section className="form-panel supplier-dialog" role="dialog" aria-modal="true" aria-labelledby="supplier-form-title"><div className="form-panel-head"><div><h2 id="supplier-form-title">{editingId === null ? "Thêm nhà cung cấp" : "Chỉnh sửa nhà cung cấp"}</h2><p>Thông tin này được dùng khi lập phiếu nhập.</p></div><button className="row-link" type="button" onClick={closeForm} aria-label="Đóng"><X size={17}/></button></div><form onSubmit={submit}><div className="form-grid"><label><span>Tên nhà cung cấp</span><input required value={form.ten_ncc} onChange={event => updateField("ten_ncc", event.target.value)} /></label><label><span>Số điện thoại</span><input value={form.sdt} onChange={event => updateField("sdt", event.target.value)} /></label><label><span>Email</span><input type="email" value={form.email} onChange={event => updateField("email", event.target.value)} /></label><label><span>Địa chỉ</span><input value={form.dia_chi} onChange={event => updateField("dia_chi", event.target.value)} /></label></div><div className="form-actions"><button className="button" type="button" onClick={closeForm}><X size={14}/> Hủy</button><button className="button primary" disabled={saving} type="submit"><Save size={14}/>{saving ? "Đang lưu…" : <><Check size={14}/> Lưu nhà cung cấp</>}</button></div></form></section></div>}
  </>;
}
