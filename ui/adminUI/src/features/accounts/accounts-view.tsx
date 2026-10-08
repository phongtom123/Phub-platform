"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accountApi, errorMessage } from "./api";
import { AccountForm } from "./account-form";
import { AccountDetail } from "./account-detail";
import { AccountProfile } from "./account-profile";
import { accountHref, roleLabels, statusLabels, type Account, type AccountPage, type AccountView } from "./types";

export default function AccountsView({ mode = "list", id }: AccountView) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [result, setResult] = useState<AccountPage | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(mode !== "create");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "create") { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setAccount(null); setResult(null);
    const params = new URLSearchParams({ q: search, page: String(page) });
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    (async () => {
      if (mode === "list") {
        const data = await accountApi<AccountPage>(`accounts?${params}`, { signal: controller.signal });
        if (!controller.signal.aborted) setResult(data);
      } else {
        const data = await accountApi<Account>(mode === "self" ? "me" : `accounts/${encodeURIComponent(id ?? "")}`, { signal: controller.signal });
        if (!controller.signal.aborted) setAccount(data);
      }
    })().catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [mode, id, search, role, status, page, version]);

  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSearch(query); setPage(1); }
  function back() {
    const referrer = document.referrer;
    if (window.history.length > 1 && referrer && new URL(referrer).origin === window.location.origin) router.back();
    else router.push("/accounts");
  }

  return <section className="live-data accounts-page">
    <nav className="live-tools" aria-label="Breadcrumb"><Link href="/">Quản trị</Link><span>›</span><Link href="/accounts">Tài khoản</Link>
      {id && <><span>›</span><Link href={accountHref(id)}>{id}</Link></>}
      {mode === "create" && <><span>›</span><Link href="/accounts/new" aria-current="page">Thêm tài khoản</Link></>}
      {mode === "edit" && id && <><span>›</span><Link href={accountHref(id, true)} aria-current="page">Chỉnh sửa</Link></>}
      {mode === "self" && <><span>›</span><Link href="/account" aria-current="page">Tài khoản của tôi</Link></>}
    </nav>
    {mode !== "list" && <button type="button" onClick={back}>← Quay lại</button>}
    <h2>{mode === "self" ? "Tài khoản của tôi" : mode === "create" ? "Thêm tài khoản" : mode === "edit" ? "Chỉnh sửa tài khoản" : "Tài khoản"}</h2>
    {error && <p className="live-error" role="alert">{error} <button onClick={() => setVersion(v => v + 1)}>Thử lại</button> <Link href="/">Về tổng quan</Link></p>}
    {loading ? <p role="status">Đang tải tài khoản…</p> : mode === "create" ? <AccountForm /> : mode === "list" && result ? <>
      <form className="live-tools" onSubmit={submitSearch}>
        <input className="live-search" aria-label="Tìm tài khoản" placeholder="Tìm mã tài khoản, tên đăng nhập hoặc email…" value={query} onChange={e => setQuery(e.target.value)} />
        <select aria-label="Vai trò" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}><option value="">Tất cả vai trò</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Trạng thái" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button>Tìm kiếm</button><button type="button" onClick={() => setVersion(v => v + 1)}>Làm mới</button><Link className="live-primary" href="/accounts/new">+ Thêm tài khoản</Link>
      </form>
      <div className="live-table"><table><thead><tr><th>Mã tài khoản</th><th>Tên đăng nhập</th><th>Chủ tài khoản</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {result.data.map(row => <tr key={row.ma_tk}><td><Link href={accountHref(row.ma_tk)}>{row.ma_tk}</Link></td><td>{row.ten_tai_khoan}{row.is_self && " (Bạn)"}</td><td>{row.ho_ten}{!row.owner_active && <small className="account-inactive">Hồ sơ ngừng hoạt động</small>}</td><td>{row.email ?? "—"}</td><td>{roleLabels[row.role]}{row.ma_kho && <small className="account-inactive">Kho {row.ma_kho}</small>}</td><td><span className={`account-status status-${row.trang_thai}`}>{statusLabels[row.trang_thai]}</span></td><td><Link href={accountHref(row.ma_tk)}>Chi tiết</Link> · <Link href={accountHref(row.ma_tk, true)}>Sửa</Link></td></tr>)}
      </tbody></table>{!result.data.length && <p className="live-note">Không có tài khoản phù hợp.</p>}</div>
      <div className="live-tools"><span>{result.total} tài khoản · Trang {page}</span><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trước</button><button disabled={page * result.page_size >= result.total} onClick={() => setPage(p => p + 1)}>Sau</button></div>
    </> : account && (mode === "edit" ? <AccountForm key={account.ma_tk} account={account} /> : mode === "self" ? <AccountProfile account={account} onChange={setAccount} /> : <AccountDetail account={account} onChange={setAccount} />)}
  </section>;
}
