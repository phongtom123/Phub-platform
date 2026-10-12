"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accountApi, errorMessage, jsonRequest } from "./api";
import { accountHref, roleLabels, type Account, type Role } from "./types";

type Warehouse = { ma_kho: number; ten_kho: string; trang_thai: number };
type WarehousePage = { data: Warehouse[]; total: number; page: number; page_size: number };
const accountPrefixes: Record<Role, string> = { ADMIN: "AD", THU_KHO: "KHO", KHACH_HANG: "KH" };

export function AccountForm({ account }: { account?: Account }) {
  const router = useRouter();
  const [username, setUsername] = useState(account?.ten_tai_khoan ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [warehouse, setWarehouse] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseError, setWarehouseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (account || role !== "THU_KHO") return;
    const controller = new AbortController();
    setLoading(true); setWarehouseError(""); setWarehouses([]);
    (async () => {
      const rows: Warehouse[] = [];
      let page = 1;
      while (!controller.signal.aborted) {
        const response = await fetch(`/api/backend/data/warehouses?page=${page}&page_size=100`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Không tải được danh sách kho.");
        const data = result as WarehousePage;
        rows.push(...data.data.filter(item => item.trang_thai === 1));
        if (page * data.page_size >= data.total || data.data.length === 0) break;
        page++;
      }
      if (!controller.signal.aborted) setWarehouses(rows);
    })()
      .catch(error => { if (!controller.signal.aborted) setWarehouseError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account, role]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!account && (!name.trim() || !role || (role === "THU_KHO" && !warehouse) || password !== confirmation)) {
      setError(password !== confirmation ? "Hai mật khẩu không khớp." : "Nhập họ tên, chọn loại tài khoản và kho nếu là nhân viên kho."); return;
    }
    setSaving(true);
    try {
      const body = account ? { ten_tai_khoan: username.trim(), email: email.trim() || null }
        : { ten_tai_khoan: username.trim(), email: email.trim() || null, password,
            new_owner: { ho_ten: name.trim(), role, ma_kho: role === "THU_KHO" ? Number(warehouse) : null } };
      const saved = await accountApi<Account>(account ? `accounts/${encodeURIComponent(account.ma_tk)}` : "accounts", jsonRequest(account ? "PATCH" : "POST", body));
      setPassword(""); setConfirmation("");
      if (saved.is_self) window.dispatchEvent(new Event("phub-account-updated"));
      router.push(accountHref(saved.ma_tk)); router.refresh();
    } catch (error) { setError(errorMessage(error)); }
    finally { setSaving(false); }
  }

  return <form className="live-form" onSubmit={save}>
    {!account && <p className="account-help account-wide">Mã tài khoản được tạo tự động khi lưu{role ? `, dạng ${accountPrefixes[role]}000001` : " theo loại tài khoản"}. Không cần nhập mã.</p>}
    <label>Tên đăng nhập *<input required minLength={3} maxLength={80} pattern="[A-Za-z0-9_.-]+" autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /><small>3–80 ký tự chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.</small></label>
    <label>Email<input type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /><small>Có thể dùng email này để đăng nhập.</small></label>
    {account ? <div className="live-field"><strong>Chủ tài khoản</strong>{account.ho_ten} · {account.ma_nhan_vien ?? account.ma_kh}<p className="account-help">Không chuyển tài khoản sang một người khác.</p></div> : <>
      <label>Họ tên *<input required maxLength={200} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Loại tài khoản *<select required value={role} onChange={e => {
        setRole(e.target.value as Role | ""); setWarehouse(""); setWarehouseError(""); setLoading(false);
      }}><option value="">Chọn loại tài khoản</option>{(Object.keys(roleLabels) as Role[]).map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
      {role === "THU_KHO" && <label>Kho phụ trách *<select required disabled={loading} value={warehouse} onChange={e => setWarehouse(e.target.value)}>
        <option value="">{loading ? "Đang tải kho…" : "Chọn kho hoạt động"}</option>
        {warehouses.map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} · {item.ma_kho}</option>)}
      </select>{warehouseError && <small role="alert">{warehouseError}</small>}
        {!loading && !warehouseError && warehouses.length === 0 && <small>Chưa có kho hoạt động. Tạo hoặc kích hoạt kho trước khi cấp tài khoản nhân viên kho.</small>}
      </label>}
      <p className="account-help account-wide">Hệ thống tạo mới nhân viên hoặc khách hàng cùng tài khoản. Không cần chọn người có sẵn.</p>
      <label>Mật khẩu *<input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>Nhập lại mật khẩu *<input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
    </>}
    {error && <p className="live-error account-wide" role="alert">{error}</p>}
    <div className="live-form-actions"><button className="live-primary" disabled={saving || loading}>{saving ? "Đang lưu…" : account ? "Lưu thay đổi" : "Tạo tài khoản"}</button><Link href={account ? accountHref(account.ma_tk) : "/accounts"}>Hủy</Link></div>
  </form>;
}
