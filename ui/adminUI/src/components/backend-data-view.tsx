"use client";

import { useEffect, useState, type FormEvent } from "react";
import { dataHref, orderChildren } from "@/src/lib/data-navigation";

type Row = Record<string, string | number | null>;
type Column = { name: string; type: string; required: boolean; generated: boolean; default: string | number | null; immutable: boolean; choices: string[] | null; system?: boolean };
type Resource = { name: string; title: string; keys: string[]; columns: Column[]; writable: boolean };
type Page = { data: Row[]; total: number; page: number; page_size: number; order_id?: string };
type View = { key: string | null; edit: boolean; create: boolean; orderId: string | null };

const labels: Record<string, string> = {
  ma_kho: "Mã kho", ten_kho: "Tên kho", dia_chi: "Địa chỉ", trang_thai: "Trạng thái",
  ma_sp: "Mã sản phẩm", sku: "SKU", ten_sp: "Tên sản phẩm", ma_loai_sp: "Mã loại sản phẩm", ten_loai_sp: "Tên loại sản phẩm",
  thuong_hieu: "Thương hiệu", gia_ban_hien_tai: "Giá bán", mo_ta: "Mô tả", thong_so_ky_thuat: "Thông số kỹ thuật",
  don_vi: "Đơn vị", bao_hanh_thang: "Bảo hành (tháng)", duong_dan_anh: "URL hình ảnh", ma_tk: "Mã tài khoản",
  ten_tai_khoan: "Tên tài khoản", password: "Mật khẩu", ma_kh: "Mã khách hàng", ten_kh: "Tên khách hàng",
  ma_nhan_vien: "Mã nhân viên", ho_ten: "Họ tên", loai_nhan_vien: "Vai trò", luong: "Lương", sdt: "Số điện thoại",
  ma_ncc: "Mã nhà cung cấp", ten_ncc: "Tên nhà cung cấp", ma_donhang: "Mã đơn hàng", kenh_ban: "Kênh bán",
  so_luong_ton: "Số lượng tồn", ma_phieu_nhap: "Mã phiếu nhập", ma_phieu_code: "Mã phiếu", ma_phieu_chuyen: "Mã chuyển kho",
  ma_ctkm: "Mã chương trình", ten_chuong_trinh: "Tên chương trình", ngay_bat_dau: "Ngày bắt đầu", ngay_ket_thuc: "Ngày kết thúc",
  ma_voucher: "Mã voucher", ma_code: "Mã giảm giá", loai_giam: "Loại giảm", gia_tri_giam: "Giá trị giảm",
  giam_toi_da: "Giảm tối đa", gia_tri_don_toi_thieu: "Giá trị đơn tối thiểu", gioi_han_tong_luot: "Tổng lượt tối đa", gioi_han_moi_khach: "Lượt mỗi khách",
  tong_tien_giam: "Tổng tiền giảm", tong_tien_sau_thue: "Tổng sau thuế", so_tien: "Số tiền",
};
const label = (name: string) => labels[name] ?? name.replaceAll("_", " ");

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api/backend/" + path, { ...options, cache: "no-store" });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(Array.isArray(detail) ? detail.map((e: { loc?: string[]; msg: string }) => [e.loc?.join("."), e.msg].filter(Boolean).join(": ")).join("; ") : typeof detail === "string" ? detail : "Không thể tải dữ liệu.");
  }
  return body as T;
}

export default function BackendDataView({ resource, embedded = false }: { resource: string; embedded?: boolean }) {
  const [meta, setMeta] = useState<Resource | null>(null);
  const [available, setAvailable] = useState<Resource[]>([]);
  const [result, setResult] = useState<Page | null>(null);
  const [route, setView] = useState<View | null>(null);
  const view = route ?? { key: null, edit: false, create: false, orderId: null };
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setView(embedded ? { key: null, edit: false, create: false, orderId: null } : {
      key: params.get("key"), edit: params.get("edit") === "1", create: params.get("new") === "1", orderId: params.get("order_id"),
    });
    setPage(1); setQuery(""); setSearch("");
  }, [resource, embedded]);

  useEffect(() => {
    if (!route) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setMeta(null); setResult(null); setDirty([]);
    (async () => {
      const resources = await api<Resource[]>("data/resources", { signal: controller.signal });
      if (controller.signal.aborted) return;
      setAvailable(resources);
      const metadata = resources.find(item => item.name === resource);
      if (!metadata) throw new Error("Bạn không có quyền xem bảng này.");
      setMeta(metadata);
      if (view.create) {
        if (!metadata.writable) throw new Error("Bảng này chưa hỗ trợ tạo trực tiếp.");
        setValues(Object.fromEntries(metadata.columns.filter(c => !c.generated).map(c => [c.name, String(c.default ?? "")])));
        return;
      }
      const params = new URLSearchParams({ page: String(view.key ? 1 : page), page_size: "20", q: view.key ? "" : search });
      if (view.key) params.set("key", view.key);
      if (view.orderId) params.set("order_id", view.orderId);
      const data = await api<Page>("data/" + resource + "?" + params, { signal: controller.signal });
      // Old deployments ignore unknown query params. Do not display unrelated
      // records as if the backend had filtered them to the selected order.
      if (view.orderId && (data.order_id !== view.orderId || data.data.some(row => row.ma_donhang !== view.orderId))) {
        throw new Error("API chưa lọc đúng đơn hàng. Cần cập nhật backend hỗ trợ order_id.");
      }
      if (view.key && !data.data.length) throw new Error("Không tìm thấy bản ghi.");
      if (controller.signal.aborted) return;
      setResult(data);
      setValues(Object.fromEntries(Object.entries(data.data[0] ?? {}).map(([key, value]) => [key, value === null ? "" : String(value)])));
    })().catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource, route, page, search, version]);

  const href = (row?: Row, edit = false) => dataHref(resource, { orderId: view.orderId,
    key: row && meta ? JSON.stringify(meta.keys.map(key => row[key])) : null, edit });
  const change = (name: string, value: string) => { setValues(current => ({ ...current, [name]: value })); setDirty(current => current.includes(name) ? current : [...current, name]); };
  const formColumns = meta?.columns.filter(c => !c.generated && !c.system && (view.create || !c.immutable)) ?? [];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meta) return;
    setSaving(true); setError("");
    try {
      const data: Record<string, string | number | null> = {};
      for (const column of formColumns) {
        if (!view.create && !dirty.includes(column.name)) continue;
        const value = values[column.name] ?? "";
        if (value === "") { if (!column.required) data[column.name] = null; continue; }
        data[column.name] = column.type === "int" ? Number(value) : column.type === "datetime" ? new Date(value).toISOString() : value;
      }
      if (resource === "accounts" && values.password) data.password = values.password;
      if (!Object.keys(data).length) throw new Error("Chưa có thay đổi.");
      const saved = await api<{ data: Row[] }>("data/" + resource + (view.key ? "?key=" + encodeURIComponent(view.key) : ""), {
        method: view.create ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!saved.data.length) throw new Error("Backend chưa trả về dữ liệu đã lưu.");
      window.location.assign(href(saved.data[0]));
    } catch (err) { setError(err instanceof Error ? err.message : "Không lưu được dữ liệu."); }
    finally { setSaving(false); }
  }

  return <section className="live-data">
    {(view.key || view.create || view.orderId) && <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : window.location.assign(href())}>← Quay lại</button>}
    <div className="live-section-heading"><h2>{embedded ? "Danh sách đơn hàng" : meta?.title ?? "Đang tải…"}</h2>{embedded && <a href={dataHref("orders")}>Xem tất cả đơn hàng →</a>}</div>
    {view.orderId && <p className="account-help">Chỉ hiển thị dữ liệu của đơn hàng <a href={dataHref("orders", { key: JSON.stringify([view.orderId]) })}>{view.orderId}</a>.</p>}
    {error && <p className="live-error" role="alert">{error} <button onClick={() => setVersion(v => v + 1)}>Thử lại</button></p>}
    {loading ? <p role="status">Đang tải dữ liệu…</p> : meta && !error && <>
      {!meta.writable && <p className="live-note">Chế độ chỉ xem dữ liệu thật. Thao tác ghi chứng từ/tồn kho/tài chính cần API nghiệp vụ theo transaction, chưa triển khai trong đợt này.</p>}
      {((view.create || view.edit) && meta.writable) ? <form className="live-form" onSubmit={save}>
        {formColumns.map(column => <label key={column.name}>{label(column.name)}{column.required && " *"}
          {column.choices ? <select value={values[column.name] ?? ""} required={column.required} onChange={e => change(column.name, e.target.value)}><option value="">Chọn…</option>{column.choices.map(choice => <option key={choice}>{choice}</option>)}</select>
          : column.type === "text" ? <textarea rows={4} required={column.required} value={values[column.name] ?? ""} onChange={e => change(column.name, e.target.value)} />
          : <input required={column.required} type={column.type === "int" ? "number" : column.type === "datetime" ? "datetime-local" : column.name === "duong_dan_anh" ? "url" : "text"} step={column.type === "int" ? "1" : undefined} value={column.type === "datetime" && values[column.name] ? new Date(values[column.name]).toLocaleString("sv-SE").replace(" ", "T").slice(0, 16) : values[column.name] ?? ""} onChange={e => change(column.name, e.target.value)} />}
          <small>{column.name}{column.name.startsWith("ma_") ? " · dùng mã tồn tại ở bảng liên quan nếu là khóa ngoại" : ""}</small>
        </label>)}
        {resource === "accounts" && <label>{view.create ? "Mật khẩu *" : "Mật khẩu mới (để trống nếu giữ nguyên)"}<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required={view.create} value={values.password ?? ""} onChange={e => change("password", e.target.value)} /></label>}
        <div className="live-form-actions"><button className="live-primary" disabled={saving}>{saving ? "Đang lưu…" : "Lưu dữ liệu"}</button><a href={dataHref(resource, { key: view.key, orderId: view.orderId })}>Hủy</a></div>
      </form> : view.key && result?.data[0] ? <>
        <div className="live-tools">{meta.writable && <a className="live-primary" href={href(result.data[0], true)}>Chỉnh sửa</a>}</div>
        <div className="live-form">{meta.columns.map(column => <div className="live-field" key={column.name}><strong>{label(column.name)}</strong>{String(result.data[0][column.name] ?? "—")}{column.name === "duong_dan_anh" && /^https?:\/\//.test(String(result.data[0][column.name] ?? "")) && <img src={String(result.data[0][column.name])} alt="Ảnh sản phẩm" />}</div>)}</div>
        {resource === "orders" && typeof result.data[0].ma_donhang === "string" && <section className="live-related">
          <h3>Thông tin liên quan đến đơn hàng</h3>
          <nav className="live-tools" aria-label="Thông tin đơn hàng">{available.filter(item => orderChildren.includes(item.name)).map(item => <a key={item.name} href={dataHref(item.name, { orderId: String(result.data[0].ma_donhang) })}>{item.title}</a>)}</nav>
        </section>}
        {resource === "invoices" && typeof result.data[0].ma_donhang === "string" && <nav className="live-tools live-related" aria-label="Thông tin đơn hàng">
          <a href={dataHref("orders", { key: JSON.stringify([result.data[0].ma_donhang]) })}>Đơn hàng {result.data[0].ma_donhang}</a>
          <a href={dataHref("payments", { orderId: result.data[0].ma_donhang })}>Thanh toán của đơn hàng</a>
        </nav>}
        {!["orders", "invoices"].includes(resource) && <nav className="live-tools" aria-label="Bảng liên quan">{available.filter(item => ({ receipts: ["receipt-lines"], transfers: ["transfer-lines"], promotions: ["vouchers"], vouchers: ["voucher-uses"], categories: ["products"] } as Record<string, string[]>)[resource]?.includes(item.name)).map(item => <a key={item.name} href={dataHref(item.name)}>{item.title}</a>)}</nav>}
      </> : <>
        <form className="live-tools" onSubmit={e => { e.preventDefault(); setSearch(query); setPage(1); }}><input className="live-search" aria-label="Tìm kiếm" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mã, tên hoặc SKU…" /><button>Tìm kiếm</button><button type="button" onClick={() => setVersion(v => v + 1)}>Làm mới</button>{meta.writable && <a className="live-primary" href={dataHref(resource, { orderId: view.orderId, create: true })}>+ Thêm {meta.title.toLowerCase()}</a>}</form>
        <div className="live-table"><table><thead><tr>{meta.columns.map(column => <th key={column.name}>{label(column.name)}</th>)}<th>Thao tác</th></tr></thead><tbody>{result?.data.map(row => <tr key={JSON.stringify(meta.keys.map(key => row[key]))}>{meta.columns.map(column => <td key={column.name}>{meta.keys.includes(column.name) ? <a href={href(row)}>{String(row[column.name] ?? "—")}</a> : String(row[column.name] ?? "—")}</td>)}<td><a href={href(row)}>Chi tiết</a>{meta.writable && <> · <a href={href(row, true)}>Sửa</a></>}</td></tr>)}</tbody></table>{!result?.data.length && <p className="live-note">Chưa có dữ liệu phù hợp.</p>}</div>
        <div className="live-tools"><span>{result?.total ?? 0} kết quả · Trang {page}</span><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><button disabled={page * 20 >= (result?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Sau</button></div>
      </>}
      <p className="live-note">Nguồn: API Python / Supabase · Không sử dụng dữ liệu mẫu thay thế khi lỗi kết nối.</p>
    </>}
  </section>;
}

