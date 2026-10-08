"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accountApi, errorMessage, jsonRequest } from "./api";
import { accountHref, roleLabels, type Account, type Owner, type OwnerPage } from "./types";

export function AccountForm({ account }: { account?: Account }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [username, setUsername] = useState(account?.ten_tai_khoan ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [kind, setKind] = useState<"employees" | "customers">("employees");
  const [ownerId, setOwnerId] = useState("");
  const [owner, setOwner] = useState<Owner | null>(null);
  const [owners, setOwners] = useState<OwnerPage | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (account) return;
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ kind, q: search, page: String(page) });
    accountApi<OwnerPage>(`account-owners?${params}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setOwners(data); })
      .catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account, kind, search, page]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!account && (!owner || owner.has_account || password !== confirmation)) {
      setError(!owner || owner.has_account ? "Chọn người chưa có tài khoản." : "Hai mật khẩu không khớp."); return;
    }
    setSaving(true);
    try {
      const body = account ? { ten_tai_khoan: username.trim(), email: email.trim() || null }
        : { ma_tk: code.trim(), ten_tai_khoan: username.trim(), email: email.trim() || null, password,
            ma_nhan_vien: kind === "employees" ? ownerId : null, ma_kh: kind === "customers" ? ownerId : null };
      const saved = await accountApi<Account>(account ? `accounts/${encodeURIComponent(account.ma_tk)}` : "accounts", jsonRequest(account ? "PATCH" : "POST", body));
      setPassword(""); setConfirmation("");
      if (saved.is_self) window.dispatchEvent(new Event("phub-account-updated"));
      router.push(accountHref(saved.ma_tk)); router.refresh();
    } catch (error) { setError(errorMessage(error)); }
    finally { setSaving(false); }
  }

  return <form className="live-form" onSubmit={save}>
    {!account && <label>Mã tài khoản *<input required maxLength={100} pattern="[A-Za-z0-9_.-]+" value={code} onChange={e => setCode(e.target.value)} placeholder="Ví dụ: TK_NV003" /></label>}
    <label>Tên đăng nhập *<input required minLength={3} maxLength={80} pattern="[A-Za-z0-9_.-]+" autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /><small>3–80 ký tự chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.</small></label>
    <label>Email<input type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /><small>Có thể dùng email này để đăng nhập.</small></label>
    {account ? <div className="live-field"><strong>Chủ tài khoản</strong>{account.ho_ten} · {account.ma_nhan_vien ?? account.ma_kh}<p className="account-help">Không chuyển tài khoản sang một người khác.</p></div> : <>
      <label>Loại hồ sơ<select value={kind} onChange={e => { setKind(e.target.value as typeof kind); setOwnerId(""); setOwner(null); setOwners(null); setPage(1); setSearch(""); setQuery(""); }}><option value="employees">Nhân viên</option><option value="customers">Khách hàng</option></select></label>
      <div className="account-wide"><label>Tìm hồ sơ theo mã hoặc tên<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm nhân viên / khách hàng có sẵn" /></label>
        <div className="live-tools"><button type="button" onClick={() => { setSearch(query); setPage(1); }}>Tìm hồ sơ</button><button type="button" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page}</span><button type="button" disabled={loading || !owners || page * owners.page_size >= owners.total} onClick={() => setPage(p => p + 1)}>Sau</button></div>
        <label>Chủ tài khoản *<select required disabled={loading} value={ownerId} onChange={e => { setOwnerId(e.target.value); setOwner(owners?.data.find(item => item.id === e.target.value) ?? owner); }}><option value="">{loading ? "Đang tải hồ sơ…" : "Chọn hồ sơ"}</option>
          {owner && !owners?.data.some(item => item.id === owner.id) && <option value={owner.id}>{owner.name} · {owner.id}</option>}
          {owners?.data.map(item => <option key={item.id} value={item.id} disabled={item.has_account}>{item.name} · {item.id} · {roleLabels[item.role]}{item.has_account ? " — Đã có tài khoản" : ""}</option>)}</select></label>
        {!loading && owners?.total === 0 && <p className="account-help">Chưa có hồ sơ phù hợp. Tạo hồ sơ tại trang Nhân viên hoặc Khách hàng trước.</p>}
        {owner && <p className="live-note">Vai trò: {roleLabels[owner.role]}{owner.ma_kho ? ` · Kho ${owner.ma_kho}` : ""}. Vai trò lấy từ hồ sơ, không tự gán quyền khách hàng thành admin.</p>}
      </div>
      <label>Mật khẩu *<input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>Nhập lại mật khẩu *<input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
    </>}
    {error && <p className="live-error account-wide" role="alert">{error}</p>}
    <div className="live-form-actions"><button className="live-primary" disabled={saving || loading}>{saving ? "Đang lưu…" : account ? "Lưu thay đổi" : "Tạo tài khoản"}</button><Link href={account ? accountHref(account.ma_tk) : "/accounts"}>Hủy</Link></div>
  </form>;
}
