"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { accountApi, errorMessage } from "./api";
import { AccountForm } from "./account-form";
import { AccountDetail } from "./account-detail";
import { AccountProfile } from "./account-profile";
import { AccountTable } from "./account-table";
import { roleLabels, statusLabels, type Account, type AccountPage, type AccountView } from "./types";

export default function AccountsView({ mode = "list", id }: AccountView) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEdit = mode === "list" ? searchParams.get("edit") || null : null;
  const [account, setAccount] = useState<Account | null>(null);
  const [result, setResult] = useState<AccountPage | null>(null);
  const [query, setQuery] = useState(requestedEdit ?? "");
  const [search, setSearch] = useState(requestedEdit ?? "");
  const [inlineEditing, setInlineEditing] = useState(false);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(mode !== "create");
  const [error, setError] = useState("");
  const effectiveSearch = requestedEdit ?? search;
  useEffect(() => { if (requestedEdit) { setQuery(requestedEdit); setSearch(requestedEdit); setPage(1); setRole(""); setStatus(""); } }, [requestedEdit]);
  const handledRequestedEdit = useCallback(() => {
    const url = new URL(window.location.href); url.searchParams.delete("edit");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  useEffect(() => {
    if (mode === "create") { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setAccount(null); setResult(null);
    const params = new URLSearchParams({ q: effectiveSearch, page: String(page) });
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
  }, [mode, id, effectiveSearch, role, status, page, version]);

  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSearch(query); setPage(1); }
  function back() {
    const referrer = document.referrer;
    if (window.history.length > 1 && referrer && new URL(referrer).origin === window.location.origin) router.back();
    else router.push("/accounts");
  }

  return <section className="live-data accounts-page">
    {mode !== "list" && (mode !== "detail" || loading || error || !account) && <div className="live-page-actions">
      <button type="button" onClick={back}>← Quay lại</button>
    </div>}
    {mode !== "detail" && <h2>{mode === "self" ? "Tài khoản của tôi" : mode === "create" ? "Thêm tài khoản" : "Tài khoản"}</h2>}
    {error && <p className="live-error" role="alert">{error} <button onClick={() => setVersion(v => v + 1)}>Thử lại</button> <Link href="/">Về tổng quan</Link></p>}
    {loading ? <p role="status">Đang tải tài khoản…</p> : mode === "create" ? <AccountForm /> : mode === "list" && result ? <>
      <form className="live-tools" onSubmit={submitSearch}>
        <fieldset className="live-form-fields" disabled={inlineEditing}>
        <input className="live-search" aria-label="Tìm tài khoản" placeholder="Tìm mã tài khoản, tên đăng nhập hoặc email…" value={query} onChange={e => setQuery(e.target.value)} />
        <select aria-label="Vai trò" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}><option value="">Tất cả vai trò</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Trạng thái" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button>Tìm kiếm</button><button type="button" onClick={() => setVersion(v => v + 1)}>Làm mới</button>
        </fieldset><Link className="live-primary" href="/accounts/new">+ Thêm tài khoản</Link>
      </form>
      <AccountTable rows={result.data} requestedEdit={requestedEdit} onRequestedEditHandled={handledRequestedEdit} onEditingChange={setInlineEditing}
        onSaved={saved => setResult(current => current && ({ ...current, data: current.data.map(row => row.ma_tk === saved.ma_tk ? saved : row) }))} />
      <div className="live-tools"><span>{result.total} tài khoản · Trang {page}</span><button disabled={inlineEditing || page === 1} onClick={() => setPage(p => p - 1)}>Trước</button><button disabled={inlineEditing || page * result.page_size >= result.total} onClick={() => setPage(p => p + 1)}>Sau</button></div>
    </> : account && (mode === "self" ? <AccountProfile account={account} onChange={setAccount} /> : <AccountDetail key={account.ma_tk} account={account} onChange={setAccount} onBack={back} />)}
  </section>;
}
