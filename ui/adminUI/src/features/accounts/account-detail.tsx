"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { accountApi, errorMessage, jsonRequest } from "./api";
import { accountHref, roleLabels, statusLabels, type Account, type AccountStatus } from "./types";

export function AccountDetail({ account, onChange }: { account: Account; onChange: (account: Account) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<"ADMIN" | "THU_KHO">(account.role === "ADMIN" ? "ADMIN" : "THU_KHO");
  const [warehouse, setWarehouse] = useState(String(account.ma_kho ?? ""));
  const [warehouses, setWarehouses] = useState<{ ma_kho: number; ten_kho: string; trang_thai: number }[]>([]);
  const [warehouseQuery, setWarehouseQuery] = useState("");
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [warehouseError, setWarehouseError] = useState("");

  useEffect(() => {
    if (!account.ma_nhan_vien) return;
    const controller = new AbortController();
    setWarehouseError("");
    fetch(`/api/backend/data/warehouses?page_size=100&q=${encodeURIComponent(warehouseSearch)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Không tải được danh sách kho."); return body.data; })
      .then(data => { if (!controller.signal.aborted) setWarehouses(data); })
      .catch(error => { if (!controller.signal.aborted) setWarehouseError(errorMessage(error)); });
    return () => controller.abort();
  }, [account.ma_nhan_vien, warehouseSearch]);

  async function mutate(path: string, body: unknown, method = "POST", message = "Đã lưu thay đổi.") {
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await accountApi<Account>(`accounts/${encodeURIComponent(account.ma_tk)}/${path}`, jsonRequest(method, body));
      onChange(saved); setNotice(message); setPassword(""); setConfirmation("");
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  function changeStatus(value: AccountStatus) {
    if (window.confirm(`Chuyển tài khoản ${account.ten_tai_khoan} sang "${statusLabels[value]}"?`)) void mutate("status", { trang_thai: value });
  }

  function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setError("Hai mật khẩu không khớp."); return; }
    if (window.confirm("Cấp lại mật khẩu sẽ làm các phiên đăng nhập cũ của tài khoản này hết hiệu lực. Tiếp tục?")) void mutate("password", { password }, "POST", "Đã cấp lại mật khẩu. Các phiên cũ không còn hợp lệ.");
  }

  return <>
    <div className="live-tools"><Link className="live-primary" href={accountHref(account.ma_tk, true)}>Chỉnh sửa</Link>
      {!account.is_self && <>
        {account.trang_thai !== 1 && <button disabled={busy} onClick={() => changeStatus(1)}>Mở khóa / hiện lại</button>}
        {account.trang_thai !== 2 && <button disabled={busy} onClick={() => changeStatus(2)}>Tạm khóa</button>}
        {account.trang_thai !== 0 && <button disabled={busy} onClick={() => changeStatus(0)}>Ẩn tài khoản</button>}
      </>}
      {account.is_self && <Link href="/account">Tài khoản của tôi / đổi mật khẩu</Link>}
    </div>
    {error && <p className="live-error" role="alert">{error}</p>}{notice && <p className="live-note" role="status">{notice}</p>}
    <div className="live-form">
      {[ ["Mã tài khoản", account.ma_tk], ["Tên đăng nhập", account.ten_tai_khoan], ["Email", account.email ?? "—"], ["Chủ tài khoản", `${account.ho_ten} · ${account.ma_nhan_vien ?? account.ma_kh}`], ["Vai trò", roleLabels[account.role]], ["Kho phụ trách", account.ma_kho ?? "Không áp dụng"], ["Trạng thái tài khoản", statusLabels[account.trang_thai]], ["Trạng thái hồ sơ", account.owner_active ? "Hoạt động" : "Ngừng hoạt động"] ].map(([name, value]) => <div className="live-field" key={name}><strong>{name}</strong>{value}</div>)}
    </div>
    {account.ma_nhan_vien && !account.is_self && <form className="live-form account-section" onSubmit={event => { event.preventDefault(); if (window.confirm("Đổi quyền sẽ có hiệu lực ở yêu cầu API tiếp theo. Tiếp tục?")) void mutate("role", { role, ma_kho: role === "THU_KHO" ? Number(warehouse) : null }, "PUT"); }}>
      <h3 className="account-wide">Phân quyền nhân viên</h3>
      <label>Vai trò<select value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="ADMIN">Quản trị viên</option><option value="THU_KHO">Nhân viên kho</option></select></label>
      {role === "THU_KHO" && <div><label>Tìm kho<input value={warehouseQuery} onChange={e => setWarehouseQuery(e.target.value)} /></label><button type="button" onClick={() => setWarehouseSearch(warehouseQuery)}>Tìm kho</button>
        <label>Kho phụ trách *<select required value={warehouse} onChange={e => setWarehouse(e.target.value)}><option value="">Chọn kho hoạt động</option>{warehouse && !warehouses.some(item => String(item.ma_kho) === warehouse) && <option value={warehouse}>Kho {warehouse}</option>}{warehouses.filter(item => item.trang_thai === 1).map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} · {item.ma_kho}</option>)}</select></label>{warehouseError && <p role="alert">{warehouseError}</p>}</div>}
      <div className="live-form-actions"><button className="live-primary" disabled={busy}>Lưu phân quyền</button></div>
    </form>}
    {!account.is_self && <form className="live-form account-section" onSubmit={resetPassword}>
      <h3 className="account-wide">Cấp lại mật khẩu</h3>
      <label>Mật khẩu mới *<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>Nhập lại mật khẩu *<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      <div className="live-form-actions"><button className="live-primary" disabled={busy}>Cấp lại mật khẩu</button></div>
    </form>}
    <p className="live-note">Không xóa tài khoản hoặc lịch sử. Khóa tài khoản chặn truy cập; mở khóa có thể khôi phục phiên chưa hết hạn. Cấp lại mật khẩu sẽ vô hiệu các phiên cũ.</p>
  </>;
}
