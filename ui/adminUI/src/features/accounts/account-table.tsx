"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { accountApi, errorMessage, jsonRequest } from "./api";
import { accountHref, roleLabels, statusLabels, type Account, type AccountStatus } from "./types";

type Editor = { id: string; username: string; email: string; focus: "username" | "email" };
type Props = {
  rows: Account[];
  requestedEdit: string | null;
  onSaved: (account: Account) => void;
  onEditingChange: (editing: boolean) => void;
  onRequestedEditHandled: () => void;
};

export function AccountTable({ rows, requestedEdit, onSaved, onEditingChange, onRequestedEditHandled }: Props) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<{ id: string; message: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const statusController = useRef<AbortController | null>(null);
  const pendingSave = useRef<Promise<boolean> | null>(null);
  const outsideAttempt = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  const usernameInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const rowNodes = useRef(new Map<string, HTMLTableRowElement>());
  const formId = useId();
  const errorId = `${formId}-error`;
  const hintId = `${formId}-hint`;
  const current = rows.find(row => row.ma_tk === editor?.id);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); statusController.current?.abort(); onEditingChange(false); };
  }, [onEditingChange]);
  useEffect(() => { onEditingChange(editor !== null || statusSaving !== null); }, [editor !== null, statusSaving !== null, onEditingChange]);
  useEffect(() => {
    if (editor) (editor.focus === "email" ? emailInput : usernameInput).current?.focus();
  }, [editor?.id, editor?.focus]);
  useEffect(() => {
    if (!requestedEdit || editor || statusController.current) return;
    const row = rows.find(item => item.ma_tk === requestedEdit);
    if (!row) return;
    setEditor({ id: row.ma_tk, username: row.ten_tai_khoan, email: row.email ?? "", focus: "username" });
    setError(""); setNotice(""); onRequestedEditHandled();
  }, [requestedEdit, rows, editor, statusSaving, onRequestedEditHandled]);

  function edit(row: Account, focus: Editor["focus"] = "username") {
    if (saving || statusController.current || (editor && editor.id !== row.ma_tk)) return;
    if (editor) { (focus === "email" ? emailInput : usernameInput).current?.focus(); return; }
    setEditor({ id: row.ma_tk, username: row.ten_tai_khoan, email: row.email ?? "", focus });
    outsideAttempt.current = null; setError(""); setNotice("");
  }
  function cancel() {
    if (controller.current) return;
    if (editor) rowNodes.current.get(editor.id)?.focus();
    outsideAttempt.current = null; setEditor(null); setError("");
  }
  function doubleClick(event: MouseEvent<HTMLTableRowElement>, row: Account) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea")) return;
    edit(row, target.closest('[data-field="email"]') ? "email" : "username");
  }
  function keyDown(event: KeyboardEvent<HTMLTableRowElement>, row: Account) {
    if (event.key === "Escape" && editor?.id === row.ma_tk) { event.preventDefault(); cancel(); }
    else if (event.key === "Enter" && event.target instanceof HTMLInputElement && editor?.id === row.ma_tk && !event.nativeEvent.isComposing) {
      event.preventDefault(); void save(true);
    }
    else if (event.target === event.currentTarget && ["F2", "Enter"].includes(event.key)) { event.preventDefault(); edit(row); }
  }
  function change(field: "username" | "email", value: string) {
    setEditor(current => current && ({ ...current, [field]: value })); setError("");
  }
  async function changeStatus(row: Account, value: number) {
    if (row.is_self || editor || controller.current || statusController.current || ![0, 1, 2].includes(value) || value === row.trang_thai) return;
    const status = value as AccountStatus;
    if (status !== 1 && !window.confirm(`Chuyển tài khoản ${row.ten_tai_khoan} sang "${statusLabels[status]}"?`)) return;
    const request = new AbortController();
    statusController.current = request; setStatusSaving(row.ma_tk); setStatusError(null); setNotice("");
    try {
      const saved = await accountApi<Account>(`accounts/${encodeURIComponent(row.ma_tk)}/status`, { ...jsonRequest("POST", { trang_thai: status }), signal: request.signal });
      if (request.signal.aborted) return;
      if (saved.ma_tk !== row.ma_tk || ![0, 1, 2].includes(saved.trang_thai)) throw new Error("API chưa trả về đúng trạng thái tài khoản đã lưu.");
      onSaved(saved); setNotice(`Đã cập nhật trạng thái tài khoản ${saved.ma_tk}: ${statusLabels[saved.trang_thai]}.`);
    } catch (error) { if (!request.signal.aborted) setStatusError({ id: row.ma_tk, message: errorMessage(error) }); }
    finally { if (!request.signal.aborted) { statusController.current = null; setStatusSaving(null); } }
  }
  const save = useCallback((restoreFocus = false): Promise<boolean> => {
    if (pendingSave.current) return pendingSave.current;
    if (!editor || !current) return Promise.resolve(false);
    const username = editor.username.trim();
    const email = editor.email.trim().toLowerCase() || null;
    const data: { ten_tai_khoan?: string; email?: string | null } = {};
    if (username !== current.ten_tai_khoan) data.ten_tai_khoan = username;
    if (email !== current.email) data.email = email;
    if (!Object.keys(data).length) {
      setEditor(null); setError("");
      if (restoreFocus) rowNodes.current.get(editor.id)?.focus();
      return Promise.resolve(true);
    }
    if (!/^[A-Za-z0-9_.-]{3,80}$/.test(username)) {
      setError("Tên đăng nhập phải có 3–80 ký tự chữ, số, dấu chấm, gạch dưới hoặc gạch ngang."); usernameInput.current?.focus(); return Promise.resolve(false);
    }
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      setError("Email không đúng định dạng."); emailInput.current?.focus(); return Promise.resolve(false);
    }
    const request = new AbortController();
    controller.current = request; setSaving(true); setError(""); setNotice("");
    const task = (async () => {
      try {
        const saved = await accountApi<Account>(`accounts/${encodeURIComponent(editor.id)}`, { ...jsonRequest("PATCH", data), signal: request.signal });
        if (request.signal.aborted) return false;
        if (saved.ma_tk !== editor.id) throw new Error("API chưa trả về đúng tài khoản đã lưu.");
        onSaved(saved); setEditor(null); setNotice(`Đã cập nhật tài khoản ${saved.ma_tk}.`);
        if (restoreFocus) rowNodes.current.get(saved.ma_tk)?.focus();
        if (saved.is_self) window.dispatchEvent(new Event("phub-account-updated"));
        return true;
      } catch (error) { if (!request.signal.aborted) setError(errorMessage(error)); return false; }
      finally { if (!request.signal.aborted) { controller.current = null; pendingSave.current = null; setSaving(false); } }
    })();
    pendingSave.current = task;
    return task;
  }, [editor, current, onSaved]);

  useEffect(() => {
    if (!editor) return;
    const editingId = editor.id;
    function isOutside(target: EventTarget | null) {
      if (!(target instanceof Element)) return false;
      // Switching fields within the row is not a save; a detail link is navigation.
      return !rowNodes.current.get(editingId)?.contains(target) || Boolean(target.closest("a[href]"));
    }
    function pointerDown(event: PointerEvent) {
      if (isOutside(event.target)) outsideAttempt.current = save();
      else outsideAttempt.current = null;
    }
    function click(event: globalThis.MouseEvent) {
      if (!isOutside(event.target)) return;
      event.preventDefault(); event.stopPropagation();
      const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
      let destination: string | null = null;
      if (anchor && !anchor.download && (!anchor.target || anchor.target === "_self") && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin === window.location.origin) destination = url.pathname + url.search + url.hash;
      }
      const attempt = outsideAttempt.current ?? save();
      outsideAttempt.current = null;
      // Do not lose the draft through navigation, and never replay a failed write.
      void attempt.then(success => { if (success && destination && mounted.current) router.push(destination); });
    }
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("click", click, true);
    return () => { document.removeEventListener("pointerdown", pointerDown, true); document.removeEventListener("click", click, true); };
  }, [editor?.id, save, router]);

  return <>
    <p className="account-help" id={hintId}>Nhấp đúp vào một hàng để đổi tên đăng nhập và email. Bấm ra ngoài hàng hoặc nhấn Enter để tự lưu; Esc để bỏ thay đổi. Chọn trạng thái trong dropdown để cập nhật; phân quyền được quản lý trong Chi tiết.</p>
    {error && <p className="live-error" id={errorId} role="alert">{error}</p>}
    {notice && <p className="live-note" role="status">{notice}</p>}
    <div className="live-table account-inline-table"><table aria-describedby={hintId}>
      <thead><tr><th>Mã tài khoản</th><th>Tên đăng nhập</th><th>Chủ tài khoản</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>{rows.map(row => {
        const editing = editor?.id === row.ma_tk;
        return <tr key={row.ma_tk} ref={node => { if (node) rowNodes.current.set(row.ma_tk, node); else rowNodes.current.delete(row.ma_tk); }} data-account-id={row.ma_tk} className={editing ? "account-row-editing" : undefined} tabIndex={0}
          onDoubleClick={event => doubleClick(event, row)} onKeyDown={event => keyDown(event, row)} title="Nhấp đúp hoặc nhấn F2 để sửa tên đăng nhập và email">
          <td><Link href={accountHref(row.ma_tk)}>{row.ma_tk}</Link></td>
          <td className="account-editable-cell" data-field="username">{editing ? <input ref={usernameInput} aria-label={`Tên đăng nhập ${row.ma_tk}`} aria-describedby={error ? errorId : hintId} aria-invalid={Boolean(error)} required minLength={3} maxLength={80} pattern="[A-Za-z0-9_.-]+" autoComplete="off" disabled={saving} value={editor.username} onChange={event => change("username", event.target.value)} /> : <>{row.ten_tai_khoan}{row.is_self && " (Bạn)"}</>}</td>
          <td>{row.ho_ten}{!row.owner_active && <small className="account-inactive">Hồ sơ ngừng hoạt động</small>}</td>
          <td className="account-editable-cell" data-field="email">{editing ? <input ref={emailInput} type="email" aria-label={`Email ${row.ma_tk}`} aria-describedby={error ? errorId : hintId} aria-invalid={Boolean(error)} maxLength={254} disabled={saving} value={editor.email} onChange={event => change("email", event.target.value)} /> : row.email ?? "—"}</td>
          <td>{roleLabels[row.role]}{row.ma_kho !== null && <small className="account-inactive">Kho {row.ma_kho}</small>}</td>
          <td><select className={`account-status-select status-${row.trang_thai}`} aria-label={`Trạng thái tài khoản ${row.ma_tk}`}
            disabled={row.is_self || editor !== null || statusSaving !== null}
            title={row.is_self ? "Không thể khóa hoặc ẩn tài khoản đang đăng nhập." : undefined}
            aria-invalid={statusError?.id === row.ma_tk} aria-describedby={statusError?.id === row.ma_tk ? `${formId}-status-${row.ma_tk}` : undefined}
            value={row.trang_thai} onChange={event => { const value = Number(event.currentTarget.value); event.currentTarget.value = String(row.trang_thai); void changeStatus(row, value); }}>
            {([1, 2, 0] as AccountStatus[]).map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
            {statusSaving === row.ma_tk && <small className="account-status-message" role="status">Đang lưu trạng thái…</small>}
            {statusError?.id === row.ma_tk && <small className="account-status-message account-status-error" id={`${formId}-status-${row.ma_tk}`} role="alert">{statusError.message}</small>}
          </td>
          <td><div className="account-row-actions"><Link href={accountHref(row.ma_tk)}>Chi tiết</Link>{editing && saving && <span role="status">Đang lưu…</span>}</div></td>
        </tr>;
      })}</tbody>
    </table>{!rows.length && <p className="live-note">Không có tài khoản phù hợp.</p>}</div>
    {editor && <p className="account-help">Bấm ra ngoài hàng để lưu trước khi tìm kiếm, lọc hay chuyển trang danh sách.</p>}
    {requestedEdit && !rows.some(row => row.ma_tk === requestedEdit) && <p className="live-note">Không tìm thấy tài khoản {requestedEdit} trong kết quả để chỉnh sửa. <button type="button" onClick={onRequestedEditHandled}>Bỏ yêu cầu sửa</button></p>}
  </>;
}
