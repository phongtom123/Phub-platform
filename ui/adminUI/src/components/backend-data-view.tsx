"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { adminFetch, invalidateAdminCache, sameAdminData } from "@/src/lib/admin-fetch";
import { useAdminPolling } from "@/src/lib/use-admin-polling";
import { dataHref, orderChildren } from "@/src/lib/data-navigation";
import { ProductGalleryEditor, type GalleryEditorHandle } from "@/src/features/forms/product-gallery-editor";
import { ProductGalleryPreview } from "@/src/features/forms/product-gallery-preview";
import { PromotionBannerEditor, PromotionBannerPreview, type BannerEditorHandle } from "@/src/features/forms/promotion-banner";
import { InlineDataTable } from "@/src/features/tables/inline-data-table";
import { ScrollableTable } from "@/src/features/tables/scrollable-table";
import { dataRowKey, inlineStatusLabels, inlineChoiceLabel, type DataRow, type DataColumn } from "@/src/lib/inline-table-data";
import { listDataColumns } from "@/src/lib/table-presentation";
import { CustomerDetail } from "@/src/features/customers/customer-detail";
import { OrderData } from "@/src/features/orders/order-data";
import { InvoiceDetail } from "@/src/features/billing/invoice-detail";
import { ProductStock } from "@/src/features/products/product-stock";
import { ProductSuppliers } from "@/src/features/products/product-suppliers";
import { CategoryDetail } from "@/src/features/categories/category-detail";
import { OperationPanel } from "@/src/features/operations/operation-panel";
import { ListFilters } from "@/src/features/operations/list-filters";
import { ReferenceInput, references } from "@/src/features/operations/reference-input";
import { StockHistory } from "@/src/features/operations/stock-history";
import "@/src/features/operations/operations.css";

type Row = DataRow;
type Column = DataColumn;
type Resource = { name: string; title: string; keys: string[]; columns: Column[]; writable: boolean;
  draft_update_path?: string | null; draft_update_fields?: string[] | null };
type Page = { data: Row[]; total: number; page: number; page_size: number; order_id?: string };
type View = { key: string | null; edit: boolean; create: boolean; orderId: string | null };

const labels: Record<string, string> = {
  ma_media_banner: "Banner khuyến mãi",
  ma_kho: "Mã kho", ten_kho: "Tên kho", dia_chi: "Địa chỉ", trang_thai: "Trạng thái",
  ma_sp: "Mã sản phẩm", sku: "SKU", ten_sp: "Tên sản phẩm", ma_loai_sp: "Mã loại sản phẩm", ma_loai_sp_con: "Mã loại sản phẩm con", ten_loai_sp: "Tên loại sản phẩm",
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
  dia_chi_chi_tiet_md: "Địa chỉ mặc định", tinh_thanh_md: "Tỉnh / thành phố", xa_phuong_md: "Xã / phường",
  ngay_sinh: "Ngày sinh", ngay_tao: "Ngày tạo", cap_nhat_luc: "Cập nhật lần cuối", luu_tru_luc: "Thời điểm lưu trữ",
  thoi_gian_dat: "Thời gian đặt", thoi_gian_xuat_kho: "Thời gian xuất kho", thoi_gian_hoan_thanh: "Thời gian hoàn thành",
  ten_nguoi_nhan: "Tên người nhận", sdt_nguoi_nhan: "Số điện thoại người nhận", dia_chi_giao_hang: "Địa chỉ giao hàng",
  ma_hoadon: "Mã hóa đơn", nguoi_lap: "Người lập", thoi_gian_lap: "Thời gian lập",
  ten_nguoi_mua: "Tên người mua", ma_so_thue: "Mã số thuế", dia_chi_nguoi_mua: "Địa chỉ người mua",
  tong_tien_truoc_thue: "Tổng trước thuế", tong_tien_thue: "Tiền thuế",
  ngay_nhap: "Ngày nhập", ngay_xuat: "Ngày xuất", ngay_nhan: "Ngày nhận", ma_kho_xuat: "Kho xuất", ma_kho_nhan: "Kho nhận",
  nguoi_tao: "Người tạo", nguoi_cap_nhat: "Người cập nhật", nguoi_xac_nhan: "Người xác nhận", nguoi_xuat: "Người xuất", nguoi_nhan: "Người nhận", ghi_chu: "Ghi chú", cccd: "CCCD",
};
const label = (name: string) => labels[name] ?? name.replaceAll("_", " ");
function displayValue(row: Row, column: Column) {
  const value = row[column.name];
  if (value === null || value === undefined) return "—";
  return inlineChoiceLabel(column.name, value);
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await adminFetch("/api/backend/" + path, { cache: "no-store", ...options });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(Array.isArray(detail) ? detail.map((e: { loc?: string[]; msg: string }) => [e.loc?.join("."), e.msg].filter(Boolean).join(": ")).join("; ") : typeof detail === "string" ? detail : "Không thể tải dữ liệu.");
  }
  const filter = new URL(path, "http://local/").searchParams.get("filters");
  if (filter && Object.keys(JSON.parse(filter)).length && JSON.stringify(body?.filters) !== JSON.stringify(JSON.parse(filter))) throw new Error("Backend chưa xác nhận đúng bộ lọc. Cần cập nhật API để tránh hiển thị bản ghi không liên quan.");
  return body as T;
}

export default function BackendDataView(props: { resource: string; embedded?: boolean }) {
  const params = useSearchParams();
  const key = params.get("key");
  if (props.resource === "customers" && !props.embedded && key && params.get("new") !== "1") {
    return <CustomerDetail key={key} recordKey={key} editMode={params.get("edit") === "1"} />;
  }
  return <GenericBackendDataView {...props} />;
}

function GenericBackendDataView({ resource, embedded = false }: { resource: string; embedded?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const workflowCreate = params.get("workflow") === "new" && ["orders", "receipts"].includes(resource);
  const filterQuery = params.get("filters") ?? "{}";
  let filters: Record<string, string> = {};
  try { const value = JSON.parse(filterQuery); if (value && typeof value === "object" && !Array.isArray(value)) filters = value; } catch { /* The API reports malformed filters. */ }
  const [meta, setMeta] = useState<Resource | null>(null);
  const [available, setAvailable] = useState<Resource[]>([]);
  const [result, setResult] = useState<Page | null>(null);
  const view: View = embedded ? { key: null, edit: false, create: false, orderId: null } : {
    key: params.get("key"), edit: params.get("edit") === "1", create: params.get("new") === "1", orderId: params.get("order_id"),
  };
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const refresh = () => { invalidateAdminCache(); setVersion(value => value + 1); };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [inlineEditing, setInlineEditing] = useState(false);
  const draftPath = resource === "receipts" && meta?.draft_update_path === `/api/admin/warehouse-drafts/${resource}` ? meta.draft_update_path : null;
  const canEditRow = (row: Row) => !draftPath || row.trang_thai === "NHAP";
  const canUpdate = Boolean(meta?.writable || draftPath);
  const inlineEnabled = ["customers", "warehouses", "products", "categories", "suppliers", "employees", "promotions", "vouchers", "receipts"].includes(resource) && canUpdate;
  const savedInline = useCallback((row: Row) => {
    setResult(current => current && ({ ...current, data: current.data.map(item =>
      dataRowKey(item, meta?.keys ?? []) === dataRowKey(row, meta?.keys ?? []) ? row : item) }));
  }, [meta?.keys]);
  const galleryEditor = useRef<GalleryEditorHandle | null>(null);
  const [galleryDirty, setGalleryDirty] = useState(false);
  const [galleryReady, setGalleryReady] = useState(false);
  const bannerEditor = useRef<BannerEditorHandle | null>(null);
  const [bannerDirty, setBannerDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const saveController = useRef<AbortController | null>(null);
  const reuseSavedRoute = useRef<string | null>(null);
  const persistedKey = useRef<string | null>(null);
  const routeIdentity = JSON.stringify([resource, embedded, view.key, view.edit, view.create, view.orderId, filterQuery]);
  useEffect(() => () => { saveController.current?.abort(); }, []);

  const pollError = useAdminPolling(JSON.stringify([routeIdentity, page, search, version]),
    !loading && !error && Boolean(result) && !view.edit && !view.create && !inlineEditing && !saving && !uploading && !dirty.length && !galleryDirty,
    async (signal, canApply) => {
      const params = new URLSearchParams({ page: String(view.key ? 1 : page), page_size: "20", q: view.key ? "" : search });
      params.set("filters", filterQuery);
      if (view.key) params.set("key", view.key);
      if (view.orderId) params.set("order_id", view.orderId);
      const data = await api<Page>("data/" + resource + "?" + params, { signal, cache: "no-cache" });
      if (view.orderId && (data.order_id !== view.orderId || data.data.some(row => row.ma_donhang !== view.orderId))) {
        throw new Error("API chưa lọc đúng đơn hàng.");
      }
      if (view.key && !data.data.length) throw new Error("Bản ghi không còn tồn tại. Hãy làm mới.");
      if (canApply()) setResult(current => sameAdminData(current, data) ? current : data);
    });

  useEffect(() => {
    if (reuseSavedRoute.current === routeIdentity) return;
    persistedKey.current = null;
    saveController.current?.abort(); saveController.current = null;
    setSaving(false); setUploading(false);
    setPage(1); setQuery(""); setSearch("");
    setGalleryDirty(false); setGalleryReady(false); setBannerDirty(false); setSaveError("");
  }, [routeIdentity]);

  useEffect(() => {
    // A newly created product already has its authoritative row. Changing only
    // its canonical edit URL must not refetch metadata or remount the form.
    if (reuseSavedRoute.current === routeIdentity) { reuseSavedRoute.current = null; return; }
    reuseSavedRoute.current = null;
    const controller = new AbortController();
    setLoading(true); setError(""); setMeta(null); setResult(null); setDirty([]); setNotice("");
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
      params.set("filters", filterQuery);
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
  }, [routeIdentity, page, search, version]);

  const href = (row?: Row, edit = false) => dataHref(resource, { orderId: view.orderId,
    key: row && meta ? JSON.stringify(meta.keys.map(key => row[key])) : null, edit });
  const change = (name: string, value: string) => { setNotice(""); setValues(current => ({ ...current, [name]: value })); setDirty(current => current.includes(name) ? current : [...current, name]); };
  const formColumns = meta?.columns.filter(c => !c.generated && !c.system && (view.create || !c.immutable) && (!draftPath || meta.draft_update_fields?.includes(c.name)) && !(resource === "products" && c.name === "duong_dan_anh")) ?? [];
  const detailMode = Boolean(view.key && !view.edit && !view.create);
  const listColumns = listDataColumns(resource, meta?.columns ?? []);
  const relatedHref = (target: string) => {
    const parent = ({ receipts: "ma_phieu_nhap", transfers: "ma_phieu_chuyen", promotions: "ma_ctkm", vouchers: "ma_voucher", subcategories: target === "categories" ? "ma_loai_sp" : "ma_loai_sp_con" } as Record<string, string>)[resource];
    return dataHref(target, { filters: parent && result?.data[0] ? { [parent]: result.data[0][parent] } : undefined });
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!meta || saving) return;
    const controller = new AbortController();
    saveController.current = controller;
    setSaving(true); setSaveError(""); setNotice("");
    let productSaved = false;
    try {
      if (resource === "products" && (!galleryReady || !galleryEditor.current)) throw new Error("Gallery chưa sẵn sàng. Hãy tải lại ảnh trước khi lưu.");
      const recordKey = resource === "products" ? persistedKey.current ?? view.key : view.key;
      const creating = view.create && !recordKey;
      const data: Record<string, string | number | null> = {};
      for (const column of formColumns) {
        if (!creating && (!dirty.includes(column.name) || column.immutable)) continue;
        const value = values[column.name] ?? "";
        if (value === "") { if (!column.required) data[column.name] = null; continue; }
        data[column.name] = column.type === "int" ? Number(value) : column.type === "datetime" ? new Date(value).toISOString() : value;
      }
      if (resource === "accounts" && values.password) data.password = values.password;
      if (resource === "promotions" && bannerDirty) {
        if (!bannerEditor.current) throw new Error("Banner chưa sẵn sàng. Hãy thử lại.");
        setUploading(true);
        data.ma_media_banner = await bannerEditor.current.prepare(controller.signal);
        if (controller.signal.aborted) return;
      }
      if (!Object.keys(data).length && !galleryDirty) throw new Error("Chưa có thay đổi.");
      const saved = Object.keys(data).length ? await api<{ data: Row[] }>((draftPath ? draftPath.slice(5) : "data/" + resource) + (recordKey ? "?key=" + encodeURIComponent(recordKey) : ""), {
        method: creating ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: controller.signal,
      }) : { data: result?.data ?? [] };
      if (!saved.data.length) throw new Error("Backend chưa trả về dữ liệu đã lưu.");
      if (controller.signal.aborted) return;
      if (resource === "products") {
        const row = saved.data[0];
        const key = JSON.stringify(meta.keys.map(name => row[name]));
        persistedKey.current = key;
        productSaved = true;
        setResult({ data: [row], total: 1, page: 1, page_size: 20 });
        setValues(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === null ? "" : String(value)])));
        setDirty([]);
        // The product may already be committed if gallery upload fails. Retain
        // its key above so retry updates this product rather than creating two.
        if (galleryDirty) {
          setUploading(true);
          const gallery = await galleryEditor.current!.save(String(row.ma_sp), controller.signal);
          if (controller.signal.aborted) return;
          const updated = { ...row, duong_dan_anh: gallery.legacy_url };
          setResult({ data: [updated], total: 1, page: 1, page_size: 20 });
          setValues(current => ({ ...current, duong_dan_anh: gallery.legacy_url ?? "" }));
        }
        setNotice(creating ? "Đã tạo sản phẩm. Bạn có thể tiếp tục chỉnh sửa." : "Đã lưu thay đổi.");
        if (view.create) {
          reuseSavedRoute.current = JSON.stringify([resource, embedded, key, true, false, view.orderId, filterQuery]);
          window.history.replaceState(null, "", dataHref(resource, { key, edit: true, orderId: view.orderId }));
        }
      } else router.push(href(saved.data[0]));
    } catch (err) { if (!controller.signal.aborted) setSaveError((productSaved && galleryDirty ? "Thông tin sản phẩm đã lưu; gallery chưa được xác nhận. " : "") + (err instanceof Error ? err.message : "Không lưu được dữ liệu.")); }
    finally { if (!controller.signal.aborted) { setSaving(false); setUploading(false); } }
  }

  return <section className="live-data">
    {pollError && <p className="live-error" role="alert">Tự cập nhật tạm lỗi; đang hiển thị dữ liệu lần tải trước. {pollError}</p>}
    {(view.key || view.create || view.orderId || workflowCreate) && <div className="live-page-actions">
      <button type="button" disabled={inlineEditing || saving} onClick={() => window.history.length > 1 ? router.back() : router.push(href())}>← Quay lại</button>
      {detailMode && !loading && !error && canUpdate && result?.data[0] && canEditRow(result.data[0]) && <Link className="live-primary" href={href(result.data[0], true)}>Chỉnh sửa</Link>}
    </div>}
    {!detailMode && <div className={embedded ? "live-section-heading" : "admin-sr-only"}><h2>{embedded ? "Danh sách đơn hàng" : meta?.title ?? "Đang tải…"}</h2>{embedded && <Link href={dataHref("orders")}>Xem tất cả đơn hàng →</Link>}</div>}
    {error && <p className="live-error" role="alert">{error} <button onClick={refresh}>Thử lại</button></p>}
    {loading ? <p role="status">Đang tải dữ liệu…</p> : meta && !error && <>
      {workflowCreate ? <OperationPanel resource={resource} create onChanged={refresh} onEditingChange={setInlineEditing} /> : ((view.create && meta.writable || view.edit && canUpdate && result?.data[0] && canEditRow(result.data[0]))) ? <form className="live-form" onSubmit={save}>
        {saveError && <p className="live-error image-save-error" role="alert">{saveError}</p>}
        <fieldset disabled={saving} className="live-form-fields">
        {resource === "products" && <ProductGalleryEditor ref={galleryEditor} productId={result?.data[0]?.ma_sp ? String(result.data[0].ma_sp) : undefined}
          disabled={saving} onDirty={setGalleryDirty} onReady={setGalleryReady} />}
        {resource === "promotions" && !formColumns.some(column => column.name === "ma_media_banner") && <p className="live-note image-save-error">Cần deploy backend mới để hỗ trợ banner khuyến mãi.</p>}
        {formColumns.map(column => resource === "promotions" && column.name === "ma_media_banner" ? <PromotionBannerEditor key={`${routeIdentity}:banner`} ref={bannerEditor}
          value={values.ma_media_banner ?? ""} disabled={saving} onChange={id => change("ma_media_banner", id)} onDirty={setBannerDirty} /> : <label key={column.name}>{label(column.name)}{column.required && " *"}
          {column.name === "trang_thai" && column.type === "int" ? <select value={values[column.name] ?? ""} required={column.required} onChange={e => change(column.name, e.target.value)}>
            <option value="">Chọn trạng thái</option>{[1, 2, 0].map(value => <option key={value} value={value}>{inlineStatusLabels[value]}</option>)}
          </select> : column.choices ? <select value={values[column.name] ?? ""} required={column.required} onChange={e => change(column.name, e.target.value)}><option value="">Chọn…</option>{column.choices.map(choice => <option key={choice} value={choice}>{inlineChoiceLabel(column.name, choice)}</option>)}</select>
          : references[column.name] && !meta.keys.includes(column.name) && !(resource === "products" && column.name === "sku") ? <ReferenceInput field={column.name} label={`Chọn ${label(column.name).toLowerCase()}`} required={column.required} value={values[column.name] ?? ""} onChange={value => change(column.name, value)} filters={column.name === "ma_loai_sp_con" && values.ma_loai_sp ? { ma_loai_sp: values.ma_loai_sp } : undefined} />
          : column.type === "text" ? <textarea rows={4} required={column.required} value={values[column.name] ?? ""} onChange={e => change(column.name, e.target.value)} />
          : <input required={column.required} type={column.type === "int" ? "number" : column.type === "date" ? "date" : column.type === "datetime" ? "datetime-local" : column.name === "duong_dan_anh" ? "url" : "text"} step={column.type === "int" ? "1" : undefined} value={column.type === "datetime" && values[column.name] ? new Date(values[column.name]).toLocaleString("sv-SE").replace(" ", "T").slice(0, 16) : values[column.name] ?? ""} onChange={e => change(column.name, e.target.value)} />}
        </label>)}
        {resource === "accounts" && <label>{view.create ? "Mật khẩu *" : "Mật khẩu mới (để trống nếu giữ nguyên)"}<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required={view.create} value={values.password ?? ""} onChange={e => change("password", e.target.value)} /></label>}
        </fieldset>
        {notice && <p className="live-note image-save-error" role="status">{notice} {result?.data[0] && <Link prefetch={false} href={href(result.data[0])}>Xem chi tiết</Link>}</p>}
        <div className="live-form-actions"><button className="live-primary" disabled={saving || (resource === "products" && (!galleryReady || ((!view.create || persistedKey.current !== null) && !galleryDirty && !dirty.length)))}>{uploading ? "Đang lưu ảnh…" : saving ? "Đang lưu…" : "Lưu dữ liệu"}</button>{!saving && <Link href={dataHref(resource, { key: persistedKey.current ?? view.key, orderId: view.orderId })}>Hủy</Link>}</div>
      </form> : view.key && result?.data[0] ? <>
        {["orders", "receipts", "inventory"].includes(resource) && <OperationPanel key={`${resource}:${view.key}`} resource={resource} row={result.data[0]} onChanged={refresh} onEditingChange={setInlineEditing} />}
        {resource === "promotions" && <PromotionBannerPreview mediaId={String(result.data[0].ma_media_banner ?? "")} name={String(result.data[0].ten_chuong_trinh ?? "")} />}
        <div className={resource === "products" ? "product-detail-layout" : undefined}>
        {resource === "products" && <ProductGalleryPreview key={String(result.data[0].ma_sp)} productId={String(result.data[0].ma_sp)}
          legacyUrl={String(result.data[0].duong_dan_anh ?? "")} name={String(result.data[0].ten_sp ?? "")} />}
        {resource === "orders" ? <OrderData rows={result.data} columns={meta.columns} keys={meta.keys} detail version={version} label={label} href={href}
          related={available.filter(item => orderChildren.includes(item.name))} />
        : resource === "invoices" ? <InvoiceDetail row={result.data[0]} columns={meta.columns} label={label} />
        : resource === "categories" ? <CategoryDetail row={result.data[0]} columns={meta.columns} label={label}
          related={available.filter(item => ["subcategories", "products"].includes(item.name))} />
        : <div className="live-form">{meta.columns.filter(column => !(resource === "promotions" && column.name === "ma_media_banner")).map(column => <div className="live-field" key={column.name}><strong>{label(column.name)}</strong>{displayValue(result.data[0], column)}</div>)}</div>}
        </div>
        {resource === "products" && available.some(item => item.name === "inventory") && <ProductStock
          key={`stock:${String(result.data[0].sku ?? "")}`} sku={String(result.data[0].sku ?? "")} unit={String(result.data[0].don_vi ?? "")} />}
        {resource === "products" && ["receipt-lines", "receipts", "suppliers"].every(name => available.some(item => item.name === name)) &&
          <ProductSuppliers key={`suppliers:${String(result.data[0].sku ?? "")}`} sku={String(result.data[0].sku ?? "")} />}
        {resource === "inventory" && <StockHistory sku={String(result.data[0].sku)} />}
        {!["orders", "invoices", "categories"].includes(resource) && <nav className="live-tools" aria-label="Bảng liên quan">{available.filter(item => ({ receipts: ["receipt-lines"], transfers: ["transfer-lines"], promotions: ["vouchers"], vouchers: ["voucher-uses"], subcategories: ["categories", "products"] } as Record<string, string[]>)[resource]?.includes(item.name)).map(item => <Link key={item.name} href={relatedHref(item.name)}>{item.title}</Link>)}</nav>}
      </> : <>
        {["invoices", "payments"].includes(resource) && <nav className="live-tools" aria-label="Hóa đơn và thanh toán"><Link href={dataHref("invoices")}>Hóa đơn</Link><Link href={dataHref("payments")}>Giao dịch thanh toán</Link></nav>}
        <form className="live-tools" onSubmit={e => { e.preventDefault(); if (!inlineEditing) { setSearch(query); setPage(1); } }}><fieldset className="live-form-fields" disabled={inlineEditing}><input className="live-search" aria-label="Tìm kiếm" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mã, tên hoặc SKU…" /><button>Tìm kiếm</button><button type="button" onClick={refresh}>Làm mới</button></fieldset>{["orders", "receipts"].includes(resource) ? <Link className="live-primary" href={`/data/${resource}?workflow=new`}>{resource === "orders" ? "+ Tạo đơn tại quầy" : "+ Lập phiếu nhập"}</Link> : meta.writable && <Link className="live-primary" href={dataHref(resource, { orderId: view.orderId, create: true })}>+ Thêm {meta.title.toLowerCase()}</Link>}</form>
        <ListFilters columns={meta.columns} values={filters} label={label} disabled={inlineEditing} onChange={next => { setPage(1); router.replace(dataHref(resource, { orderId: view.orderId, filters: next })); }} />
        {resource === "inventory" && <StockHistory />}
        {draftPath && <p className="inline-data-help">Nhấp đúp để sửa phiếu nháp. Phiếu đã xử lý chỉ xem thông tin; trạng thái được cập nhật qua nghiệp vụ kho.</p>}
        {resource === "orders" ? <OrderData rows={result?.data ?? []} columns={meta.columns} keys={meta.keys} version={version} label={label} href={href} />
        : inlineEnabled ? <InlineDataTable resource={resource} rows={result?.data ?? []} columns={listColumns} keys={meta.keys}
          quickEditFields={resource === "products" ? ["ten_sp", "thuong_hieu", "gia_ban_hien_tai", "don_vi", "bao_hanh_thang", "trang_thai"] : undefined}
          editableFields={draftPath ? meta.draft_update_fields ?? [] : undefined}
          writePath={draftPath ? "/api/backend/" + draftPath.slice(5) : undefined} canEditRow={canEditRow}
          label={label} href={href} onSaved={savedInline} onEditingChange={setInlineEditing} />
        : <ScrollableTable><table><thead><tr>{listColumns.map(column => <th key={column.name}>{label(column.name)}</th>)}<th>Thao tác</th></tr></thead><tbody>{result?.data.map(row => <tr key={JSON.stringify(meta.keys.map(key => row[key]))}>{listColumns.map(column => <td key={column.name}>{meta.keys.includes(column.name) ? <Link href={href(row)}>{displayValue(row, column)}</Link> : displayValue(row, column)}</td>)}<td><Link href={href(row)}>Chi tiết</Link>{meta.writable && <> · <Link href={href(row, true)}>Sửa</Link></>}</td></tr>)}</tbody></table>{!result?.data.length && <p className="live-note">Chưa có dữ liệu phù hợp.</p>}</ScrollableTable>}
        <div className="live-tools"><span>{result?.total ?? 0} kết quả · Trang {page}</span><button disabled={inlineEditing || page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><button disabled={inlineEditing || page * 20 >= (result?.total ?? 0)} onClick={() => setPage(p => p + 1)}>Sau</button></div>
      </>}
    </>}
  </section>;
}

