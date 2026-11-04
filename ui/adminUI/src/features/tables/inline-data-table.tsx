"use client";

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScrollableTable } from "./scrollable-table";
import { adminFetch } from "@/src/lib/admin-fetch";
import { dataRowKey, editableDataColumns, inlinePatch, inlineOptions, inlineChoiceLabel, inlineDraftValue, type DataColumn, type DataRow } from "@/src/lib/inline-table-data";

type Props = { resource: string; rows: DataRow[]; columns: DataColumn[]; keys: string[];
  quickEditFields?: readonly string[];
  editableFields?: readonly string[]; writePath?: string; canEditRow?: (row: DataRow) => boolean;
  label: (name: string) => string; href: (row: DataRow) => string;
  onSaved: (row: DataRow) => void; onEditingChange: (editing: boolean) => void };
type Editor = { key: string; draft: Record<string, string>; field: string };

export function InlineDataTable({ resource, rows, columns, keys, label, href, onSaved, onEditingChange, quickEditFields, editableFields, writePath, canEditRow }: Props) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<Promise<boolean> | null>(null);
  const outsideAttempt = useRef<Promise<boolean> | null>(null);
  const outsideDestination = useRef<string | null>(null);
  const rowNodes = useRef(new Map<string, HTMLTableRowElement>());
  const inputNodes = useRef(new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>());
  const mounted = useRef(true);
  const id = useId();
  const allowedFields = editableFields ?? quickEditFields;
  const editable = editableDataColumns(columns, keys).filter(column => !allowedFields || allowedFields.includes(column.name));
  const textColumns = editable.filter(column => column.name !== "trang_thai");
  const current = editor ? rows.find(row => dataRowKey(row, keys) === editor.key) : undefined;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); onEditingChange(false); };
  }, [onEditingChange]);
  useEffect(() => { onEditingChange(Boolean(editor) || saving); }, [Boolean(editor), saving, onEditingChange]);
  useEffect(() => { if (editor) inputNodes.current.get(editor.field)?.focus(); }, [editor?.key, editor?.field]);

  function edit(row: DataRow, field?: string) {
    if (controller.current || editor || !textColumns.length || canEditRow?.(row) === false) return;
    setEditor({ key: dataRowKey(row, keys), field: textColumns.find(column => column.name === field)?.name ?? textColumns[0].name,
      draft: Object.fromEntries(textColumns.map(column => [column.name, inlineDraftValue(column, row[column.name])])) });
    outsideAttempt.current = null; outsideDestination.current = null; setError(""); setNotice("");
  }
  function cancel() {
    if (!editor || controller.current) return;
    outsideDestination.current = null; outsideAttempt.current = null;
    setEditor(null); setError(""); rowNodes.current.get(editor.key)?.focus();
  }
  const write = useCallback(async (row: DataRow, patch: DataRow, request: AbortController) => {
    const key = dataRowKey(row, keys);
    const response = await adminFetch(`${writePath ?? `/api/backend/data/${resource}`}?key=${encodeURIComponent(key)}`, {
      method: "PATCH", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch), signal: request.signal,
    });
    const body = await response.json();
    if (!response.ok) {
      const detail = body?.detail;
      throw new Error(typeof detail === "string" ? detail : Array.isArray(detail)
        ? detail.map((item: { msg: string }) => item.msg).join("; ") : "Không lưu được thay đổi.");
    }
    const saved = body?.data?.[0] as DataRow | undefined;
    if (!saved || dataRowKey(saved, keys) !== key) throw new Error("API chưa trả về đúng bản ghi đã lưu.");
    if (request.signal.aborted) return;
    onSaved(saved); setNotice("Đã lưu thay đổi.");
  }, [resource, keys, onSaved, writePath]);

  const save = useCallback((restoreFocus = false): Promise<boolean> => {
    if (pending.current) return pending.current;
    if (!editor || !current || controller.current) return Promise.resolve(false);
    let patch: DataRow;
    try { patch = inlinePatch(columns, keys, current, editor.draft, label); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dữ liệu không hợp lệ."); return Promise.resolve(false); }
    if (!Object.keys(patch).length) { setEditor(null); setError(""); return Promise.resolve(true); }
    const request = new AbortController(); controller.current = request;
    setSaving(true); setError(""); setNotice("");
    const task = (async () => {
      try {
        await write(current, patch, request);
        if (request.signal.aborted) return false;
        setEditor(null);
        if (restoreFocus) rowNodes.current.get(editor.key)?.focus();
        return true;
      } catch (reason) { if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : "Không lưu được thay đổi."); return false; }
      finally { if (!request.signal.aborted) { controller.current = null; pending.current = null; setSaving(false); } }
    })();
    pending.current = task; return task;
  }, [editor, current, columns, keys, label, write]);

  useEffect(() => {
    if (!editor) return;
    const isOutside = (target: EventTarget | null) => target instanceof Element &&
      !target.closest("[data-table-scrollbar]") && !target.matches("[data-table-scroll-viewport]") &&
      (!rowNodes.current.get(editor.key)?.contains(target) || Boolean(target.closest("a[href]")));
    const linkDestination = (event: PointerEvent | globalThis.MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self") || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return null;
      const url = new URL(anchor.href, window.location.href);
      return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
    };
    const pointerDown = (event: PointerEvent) => {
      // Keep link intent if removing an error or disabling inputs shifts the row
      // between pointerdown and click. Do not navigate until the save succeeds.
      outsideDestination.current = isOutside(event.target) ? linkDestination(event) : null;
      outsideAttempt.current = isOutside(event.target) ? save() : null;
    };
    const click = (event: globalThis.MouseEvent) => {
      if (!isOutside(event.target) && !outsideDestination.current) return;
      event.preventDefault(); event.stopPropagation();
      const destination = outsideDestination.current ?? linkDestination(event);
      outsideDestination.current = null;
      const task = outsideAttempt.current ?? save(); outsideAttempt.current = null;
      void task.then(success => { if (success && destination && mounted.current) router.push(destination); });
    };
    document.addEventListener("pointerdown", pointerDown, true); document.addEventListener("click", click, true);
    return () => { document.removeEventListener("pointerdown", pointerDown, true); document.removeEventListener("click", click, true); };
  }, [editor?.key, save, router]);

  async function changeStatus(row: DataRow, value: string | number) {
    const column = editable.find(column => column.name === "trang_thai");
    if (!column || editor || controller.current || canEditRow?.(row) === false || !inlineOptions(column).some(option => option.value === value) || value === row.trang_thai) return;
    if (![1, "HOAT_DONG"].includes(value) && !window.confirm(`Chuyển trạng thái thành "${inlineChoiceLabel("trang_thai", value)}"?`)) return;
    const request = new AbortController(); controller.current = request; setSaving(true); setError(""); setNotice("");
    try { await write(row, { trang_thai: value }, request); }
    catch (reason) { if (!request.signal.aborted) setError(reason instanceof Error ? reason.message : "Không lưu được trạng thái."); }
    finally { if (!request.signal.aborted) { controller.current = null; setSaving(false); } }
  }
  function doubleClick(event: MouseEvent<HTMLTableRowElement>, row: DataRow) {
    const target = event.target as HTMLElement;
    if (!target.closest("a, button, input, select, textarea")) edit(row, target.closest<HTMLElement>("[data-field]")?.dataset.field);
  }
  function keyDown(event: KeyboardEvent<HTMLTableRowElement>, row: DataRow) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && editor && !controller.current) { event.preventDefault(); cancel(); }
    else if (event.key === "Enter" && (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) && editor) { event.preventDefault(); void save(true); }
    else if (event.target === event.currentTarget && ["Enter", "F2"].includes(event.key)) { event.preventDefault(); edit(row); }
  }

  return <>
    <p className={quickEditFields ? "inline-data-help" : "admin-sr-only"} id={`${id}-help`}>{quickEditFields ? "Sửa nhanh tên, thương hiệu, giá bán, đơn vị, bảo hành và trạng thái. " : ""}Nhấp đúp hoặc nhấn F2 để sửa. Bấm ra ngoài hàng hoặc Enter để lưu; Esc để hủy.</p>
    {error && <p className="live-error" role="alert" id={`${id}-error`}>{error}</p>}
    {notice && <p className="live-note" role="status">{notice}</p>}
    <ScrollableTable className="inline-data-table"><table aria-describedby={`${id}-help`} aria-busy={saving}>
      <thead><tr>{columns.map(column => <th key={column.name}>{label(column.name)}</th>)}<th>Thao tác</th></tr></thead>
      <tbody>{rows.map(row => {
        const key = dataRowKey(row, keys); const editing = editor?.key === key;
        return <tr key={key} ref={node => { if (node) rowNodes.current.set(key, node); else rowNodes.current.delete(key); }}
          tabIndex={0} className={editing ? "inline-data-row-editing" : undefined} title={canEditRow?.(row) === false ? "Phiếu đã xử lý chỉ xem thông tin" : "Nhấp đúp hoặc nhấn F2 để chỉnh sửa"}
          onDoubleClick={event => doubleClick(event, row)} onKeyDown={event => keyDown(event, row)}>
          {columns.map(column => <td key={column.name} data-field={column.name}>
            {keys.includes(column.name) ? <Link href={href(row)}>{String(row[column.name] ?? "—")}</Link>
            : column.name === "trang_thai" && editable.some(item => item.name === column.name) && inlineOptions(column).length ? <select
              className={`inline-data-status status-${row.trang_thai}`} aria-label={`${label(column.name)} ${keys.map(name => row[name]).join(" / ")}`}
              value={String(row[column.name])} disabled={Boolean(editor) || saving || canEditRow?.(row) === false}
              onChange={event => { const value = column.type === "int" ? Number(event.currentTarget.value) : event.currentTarget.value; event.currentTarget.value = String(row[column.name]); void changeStatus(row, value); }}>
              {inlineOptions(column).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select> : editing && textColumns.some(item => item.name === column.name) && column.choices ? <select
              ref={node => { if (node) inputNodes.current.set(column.name, node); else inputNodes.current.delete(column.name); }}
              aria-label={`${label(column.name)} ${keys.map(name => row[name]).join(" / ")}`} value={editor.draft[column.name] ?? ""} disabled={saving}
              onChange={event => { const value = event.target.value; setEditor(current => current && ({ ...current, draft: { ...current.draft, [column.name]: value } })); setError(""); }}>
              {inlineOptions(column).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select> : editing && textColumns.some(item => item.name === column.name) ? <input
              ref={node => { if (node) inputNodes.current.set(column.name, node); else inputNodes.current.delete(column.name); }}
              aria-label={`${label(column.name)} ${keys.map(name => row[name]).join(" / ")}`} aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : `${id}-help`} required={column.required} disabled={saving}
              type={column.type === "int" ? "number" : column.type === "date" ? "date" : ["datetime", "timestamptz"].includes(column.type) ? "datetime-local" : "text"} step={["datetime", "timestamptz"].includes(column.type) ? "1" : undefined} maxLength={column.type === "text" ? 20000 : 2000}
              inputMode={column.type.startsWith("decimal") ? "decimal" : undefined} min={column.name === "bao_hanh_thang" ? 0 : undefined}
              value={editor.draft[column.name] ?? ""} onChange={event => { const value = event.target.value; setEditor(current => current && ({ ...current, draft: { ...current.draft, [column.name]: value } })); setError(""); }} />
            : inlineChoiceLabel(column.name, row[column.name])}
          </td>)}
          <td><div className="inline-data-actions"><Link href={href(row)}>Chi tiết</Link>
            {quickEditFields && editing && <>
              <button type="button" disabled={saving} onClick={() => void save(true)}>{saving ? "Đang lưu…" : "Lưu"}</button>
              <button type="button" disabled={saving} onClick={cancel}>Hủy</button>
            </>}
            {editing && saving && <span className="admin-sr-only" role="status">Đang lưu…</span>}
          </div></td>
        </tr>;
      })}</tbody>
    </table>{!rows.length && <p className="live-note">Chưa có dữ liệu phù hợp.</p>}</ScrollableTable>
  </>;
}
