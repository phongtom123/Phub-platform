"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { adminFetch } from "@internal/lib/admin-fetch";
import { accountApi, errorMessage, jsonRequest } from "./api";
import { accountHref, roleLabels, statusLabels, type Account, type AccountStatus, type Role } from "./types";

export function AccountDetail({ account, onChange, onBack, onEditingChange }: { account: Account; onChange: (account: Account) => void; onBack: () => void; onEditingChange: (editing: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [role, setRole] = useState<Role>(account.role);
  const [warehouse, setWarehouse] = useState(String(account.ma_kho ?? ""));
  const [warehouses, setWarehouses] = useState<{ ma_kho: number; ten_kho: string; trang_thai: number }[]>([]);
  const [warehouseQuery, setWarehouseQuery] = useState("");
  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [warehouseError, setWarehouseError] = useState("");
  useEffect(() => { setRole(account.role); setWarehouse(String(account.ma_kho ?? "")); }, [account.role, account.ma_kho]);
  useEffect(() => {
    onEditingChange(busy || Boolean(password || confirmation || warehouseQuery) || role !== account.role || warehouse !== String(account.ma_kho ?? ""));
  }, [busy, password, confirmation, warehouseQuery, role, warehouse, account.role, account.ma_kho, onEditingChange]);
  useEffect(() => () => onEditingChange(false), [onEditingChange]);
  const archived = Boolean(account.luu_tru_luc);
  const canManageRole = Boolean(account.ma_nhan_vien) && !account.is_self && !archived;
  const canAssignWarehouse = canManageRole && role === "NHAN_VIEN";
  const roleHelp = !account.ma_nhan_vien
    ? "Tài khoản khách hàng không áp dụng phân quyền nhân viên. Không thể nâng quyền khách hàng tại đây."
    : account.is_self
      ? "Bạn đang xem tài khoản đang đăng nhập. Không thể tự thay đổi phân quyền tại đây."
      : "Chọn vai trò nhân viên. Nhân viên kho cần được gán một kho đang hoạt động.";

  useEffect(() => {
    if (!canAssignWarehouse) return;
    const controller = new AbortController();
    setWarehouseError("");
    adminFetch(`/api/backend/data/warehouses?page_size=100&q=${encodeURIComponent(warehouseSearch)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Không tải được danh sách kho."); return body.data; })
      .then(data => { if (!controller.signal.aborted) setWarehouses(data); })
      .catch(error => { if (!controller.signal.aborted) setWarehouseError(errorMessage(error)); });
    return () => controller.abort();
  }, [canAssignWarehouse, warehouseSearch]);

  async function mutate(path: string, body: unknown, method = "POST", message = "Đã lưu thay đổi.") {
    if (busy) return;
    if (account.is_self) { setError("Thao tác này không áp dụng cho tài khoản đang đăng nhập."); return; }
    if (archived && path !== "archive") { setError("Cần khôi phục tài khoản trước khi chỉnh sửa."); return; }
    if (path === "role" && !canManageRole) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await accountApi<Account>(`accounts/${encodeURIComponent(account.ma_tk)}/${path}`, jsonRequest(method, body));
      if (saved.ma_tk !== account.ma_tk || (path === "archive" && Boolean(saved.luu_tru_luc) !== !archived)) throw new Error("API chưa xác nhận đúng tài khoản và trạng thái đã lưu.");
      onChange(saved); setNotice(message); setPassword(""); setConfirmation("");
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }

  function changeStatus(value: AccountStatus) {
    if (account.is_self || busy) return;
    if (window.confirm(`Chuyển tài khoản ${account.ten_tai_khoan} sang "${statusLabels[value]}"?`)) void mutate("status", { trang_thai: value });
  }

  function changeRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageRole || busy) return;
    if (window.confirm("Đổi quyền sẽ có hiệu lực ở yêu cầu API tiếp theo. Tiếp tục?")) void mutate("role", { role, ma_kho: role === "NHAN_VIEN" ? Number(warehouse) : null }, "PUT");
  }

  function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (account.is_self || busy) return;
    if (password !== confirmation) { setError("Hai mật khẩu không khớp."); return; }
    if (window.confirm("Cấp lại mật khẩu sẽ làm các phiên đăng nhập cũ của tài khoản này hết hiệu lực. Tiếp tục?")) void mutate("password", { password }, "POST", "Đã cấp lại mật khẩu. Các phiên cũ không còn hợp lệ.");
  }

  return <>
    <div className="live-page-actions">
      <button type="button" onClick={onBack}>← Quay lại</button>
      <div className="live-page-actions-group">
        {!archived && ([1, 2, 0] as AccountStatus[]).filter(value => value !== account.trang_thai).map(value => <button key={value} disabled={busy || account.is_self}
          title={account.is_self ? "Không thể khóa hoặc ẩn tài khoản đang đăng nhập." : undefined}
          onClick={() => changeStatus(value)}>{value === 1 ? "Mở khóa / hiện lại" : value === 2 ? "Tạm khóa" : "Ẩn tài khoản"}</button>)}
        {!archived && <Link className="live-primary" href={accountHref(account.ma_tk, true)}>Chỉnh sửa</Link>}
        <button type="button" disabled={busy || account.is_self} onClick={() => {
          if (window.confirm(archived ? "Khôi phục tài khoản? Tài khoản vẫn ẩn cho đến khi bạn bật lại." : "Xóa tài khoản? Chặn đăng nhập và vô hiệu phiên cũ; dữ liệu và lịch sử vẫn được giữ lại."))
            void mutate("archive", { archived: !archived }, "POST", archived ? "Đã khôi phục. Tài khoản vẫn ẩn; bạn có thể bật lại sau khi kiểm tra hồ sơ." : "Đã xóa tài khoản và vô hiệu các phiên cũ.");
        }}>{archived ? "Khôi phục tài khoản" : "Xóa tài khoản"}</button>
      </div>
    </div>
    {error && <p className="live-error" role="alert">{error}</p>}{notice && <p className="live-note" role="status">{notice}</p>}
    {archived && <p className="live-note">Tài khoản đã xóa lúc {new Date(account.luu_tru_luc!).toLocaleString("vi-VN")}, bởi {account.luu_tru_boi ?? "—"}. Khôi phục trước khi chỉnh sửa hoặc bật lại.</p>}
    <div className="live-form account-detail-card">
      {[ ["Mã tài khoản", account.ma_tk], ["Tên đăng nhập", account.ten_tai_khoan], ["Email", account.email ?? "—"], ["Chủ tài khoản", `${account.ho_ten} · ${account.ma_nhan_vien ?? account.ma_kh}`], ["Vai trò", roleLabels[account.role]], ["Kho phụ trách", account.ma_kho ?? "Không áp dụng"], ["Trạng thái tài khoản", statusLabels[account.trang_thai]], ["Trạng thái hồ sơ", account.owner_active ? "Hoạt động" : "Ngừng hoạt động"] ].map(([name, value]) => <div className="live-field" key={name}><strong>{name}</strong>{value}</div>)}
    </div>
    <form className="live-form account-section account-role-card" onSubmit={changeRole} aria-labelledby="account-role-title">
      <h3 className="account-wide" id="account-role-title">Phân quyền nhân viên</h3>
      <p className="account-wide account-help account-card-description" id="account-role-help">{roleHelp}</p>
      <fieldset className="live-form-fields" disabled={busy || !canManageRole} aria-describedby="account-role-help">
        <label>Vai trò<select value={role} onChange={e => setRole(e.target.value as Role)}>
          {!account.ma_nhan_vien ? <option value="KHACH_HANG">Khách hàng</option> : <><option value="ADMIN">Quản trị viên</option><option value="NHAN_VIEN">Nhân viên kho</option></>}
        </select></label>
        {canAssignWarehouse && <>
        <div className="account-warehouse-search">
          <label htmlFor="account-warehouse-query">Tìm kho</label>
          <div className="account-warehouse-search-row"><input id="account-warehouse-query" placeholder="Mã hoặc tên kho" value={warehouseQuery} onChange={e => setWarehouseQuery(e.target.value)} />
            <button type="button" onClick={() => setWarehouseSearch(warehouseQuery)}>Tìm kho</button></div>
        </div>
        <label>Kho phụ trách *<select required value={warehouse} onChange={e => setWarehouse(e.target.value)}>
          <option value="">Chọn kho hoạt động</option>
          {warehouse && !warehouses.some(item => String(item.ma_kho) === warehouse) && <option value={warehouse}>Kho {warehouse}</option>}{warehouses.filter(item => item.trang_thai === 1).map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} · {item.ma_kho}</option>)}
        </select></label>
        {warehouseError && <p className="account-wide" role="alert">{warehouseError}</p>}
        </>}
        <div className="live-form-actions"><button className="live-primary">Lưu phân quyền</button></div>
      </fieldset>
    </form>
    <form className="live-form account-section account-password-card" onSubmit={resetPassword} aria-labelledby="account-password-title">
      <h3 className="account-wide" id="account-password-title">Cấp lại mật khẩu</h3>
      <p className="account-wide account-help account-card-description" id="account-password-help">{account.is_self
        ? <>Để đổi mật khẩu của bạn, mở <Link href="/account">Tài khoản của tôi / đổi mật khẩu</Link> và xác nhận mật khẩu hiện tại.</>
        : "Cấp mật khẩu mới cho tài khoản này sẽ vô hiệu các phiên đăng nhập cũ."}</p>
      <fieldset className="live-form-fields" disabled={busy || account.is_self || archived} aria-describedby="account-password-help">
        <label>Mật khẩu mới *<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Nhập lại mật khẩu *<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
        <div className="live-form-actions"><button className="live-primary">Cấp lại mật khẩu</button></div>
      </fieldset>
    </form>
    <p className="live-note">Khi xóa, hệ thống vẫn giữ lại tài khoản và lịch sử, chỉ chặn đăng nhập và vô hiệu phiên cũ. Khôi phục giữ tài khoản ở trạng thái ẩn để bạn chủ động bật lại. Tên đăng nhập và email vẫn được giữ cho tài khoản này.</p>
  </>;
}
