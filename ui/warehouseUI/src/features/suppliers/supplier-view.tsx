"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Panel, StatusBadge, EmptyState } from "@/src/components/warehouse/ui";
import { getSuppliers, type SupplierRecord } from "@/src/models/warehouse-model";

export default function SupplierView() {
  const [rows, setRows] = useState<SupplierRecord[]>([]);
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  async function load() { setLoading(true); setError(""); try { const result = await getSuppliers(); setRows(result.data); } catch (err) { setError(err instanceof Error ? err.message : "Không thể tải nhà cung cấp."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => rows.filter(row => { const haystack = `${row.ten_ncc} ${row.sdt ?? ""} ${row.email ?? ""} ${row.dia_chi ?? ""}`.toLocaleLowerCase("vi"); return haystack.includes(query.toLocaleLowerCase("vi")) && (status === "all" || (status === "active" ? row.trang_thai === 1 : row.trang_thai !== 1)); }), [rows, query, status]);
  return <section className="warehouse-workspace"><div className="page-heading"><div><h1>Nhà cung cấp</h1><p>Tra cứu thông tin nhà cung cấp để lập phiếu nhập.</p></div></div><Panel title={`Danh sách nhà cung cấp (${filtered.length})`} subtitle="Nhân viên kho chỉ được xem và chọn nhà cung cấp; thay đổi dữ liệu do quản trị viên thực hiện."><div className="table-toolbar"><label className="search-box"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm tên, email, số điện thoại…" /></label><select className="filter-select" aria-label="Trạng thái" value={status} onChange={event => setStatus(event.target.value)}><option value="active">Đang hoạt động</option><option value="inactive">Ngừng hoạt động</option><option value="all">Tất cả</option></select></div>{error && <div className="module-note form-error"><span>!</span>{error}<button className="button" type="button" onClick={() => void load()}>Thử lại</button></div>}<div className="table-wrap">{loading ? <p className="empty-state">Đang tải nhà cung cấp…</p> : filtered.length ? <table><thead><tr><th>TÊN NHÀ CUNG CẤP</th><th>ĐIỆN THOẠI</th><th>EMAIL</th><th>ĐỊA CHỈ</th><th>TRẠNG THÁI</th></tr></thead><tbody>{filtered.map(row => <tr key={row.ma_ncc}><td className="strong-value">{row.ten_ncc}</td><td>{row.sdt ?? "—"}</td><td>{row.email ?? "—"}</td><td>{row.dia_chi ?? "—"}</td><td><StatusBadge value={row.trang_thai === 1 ? "Đang hoạt động" : "Ngừng hoạt động"}/></td></tr>)}</tbody></table> : <EmptyState text="Không tìm thấy nhà cung cấp phù hợp." />}</div></Panel></section>;
}
