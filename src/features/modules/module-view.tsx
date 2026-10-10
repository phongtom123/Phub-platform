"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Ban, CheckCircle2, Download, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Panel, StatusBadge, EmptyState } from "@/src/components/warehouse/ui";
import type { DataRow, ModuleDefinition } from "@/src/types/warehouse";
import { cancelReceipt, cancelTransfer, confirmReceipt, dispatchOrder, dispatchTransfer, getDispatches, getHistory, getInventory, getPending, getProducts, getReceipts, getTransfers, hasApiToken, receiveTransfer } from "@/src/lib/warehouse-api";

export default function ModuleView({ definition, section, onAdd }: { definition: ModuleDefinition; section: string; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [apiRows, setApiRows] = useState<DataRow[] | null>(null);
  const [apiError, setApiError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (!["inventory", "products", "receipts", "transfers", "dispatches", "pending", "history"].includes(section) || !hasApiToken()) return;
    let cancelled = false;
    const load = section === "inventory"
      ? getInventory().then(result => result.items.map(item => ({ id: item.sku, name: item.product_name, code: `${item.sku} · ${item.unit}`, location: item.location ?? "—", quantity: item.quantity, status: item.status })))
      : section === "products" ? getProducts()
      : section === "receipts" ? getReceipts()
      : section === "transfers" ? getTransfers()
      : section === "dispatches" ? getDispatches()
      : section === "pending" ? getPending()
      : getHistory();
    load.then(result => {
      if (cancelled) return;
      setApiRows(result);
    }).catch(error => { if (!cancelled) setApiError(error instanceof Error ? error.message : "Không thể tải dữ liệu tồn kho"); });
    return () => { cancelled = true; };
  }, [section]);
  async function handleConfirm(row: DataRow) {
    const recordId = Number(row.recordId);
    if (!Number.isInteger(recordId)) return;
    setConfirming(row.id); setApiError("");
    try {
      await confirmReceipt(recordId);
      setApiRows(current => current?.map(item => item.id === row.id ? { ...item, status: "Đã nhập" } : item) ?? null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Không thể xác nhận phiếu nhập");
    } finally { setConfirming(null); }
  }
  async function handleTransferAction(row: DataRow) {
    const recordId = Number(row.recordId);
    if (!Number.isInteger(recordId)) return;
    const receiving = row.status === "Đang chuyển";
    setConfirming(row.id); setApiError("");
    try {
      if (receiving) await receiveTransfer(recordId); else await dispatchTransfer(recordId);
      setApiRows(current => current?.map(item => item.id === row.id ? { ...item, status: receiving ? "Đã nhận" : "Đang chuyển" } : item) ?? null);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Không thể cập nhật phiếu chuyển kho");
    } finally { setConfirming(null); }
  }
  async function handleCancel(row: DataRow) {
    const recordId = Number(row.recordId);
    if (!Number.isInteger(recordId)) return;
    setConfirming(row.id); setApiError("");
    try {
      if (section === "receipts") await cancelReceipt(recordId); else await cancelTransfer(recordId);
      setApiRows(current => current?.map(item => item.id === row.id ? { ...item, status: "Đã hủy" } : item) ?? null);
    } catch (error) { setApiError(error instanceof Error ? error.message : "Không thể hủy phiếu."); }
    finally { setConfirming(null); }
  }
  async function handleDispatchOrder(row: DataRow) {
    const orderId = String(row.recordId ?? row.order ?? "");
    if (!orderId) return;
    setConfirming(row.id); setApiError("");
    try { await dispatchOrder(orderId); setApiRows(current => current?.map(item => item.id === row.id ? { ...item, status: "Đã xuất" } : item) ?? null); }
    catch (error) { setApiError(error instanceof Error ? error.message : "Không thể xuất kho theo đơn hàng"); }
    finally { setConfirming(null); }
  }
  const sourceRows = apiRows ?? definition.rows;
  const rows = useMemo(() => sourceRows.filter(row => Object.values(row).some(value => String(value).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))) && Object.entries(filters).every(([filter, value]) => !value || String(row[filter] ?? "").toLocaleLowerCase("vi") === value.toLocaleLowerCase("vi"))), [sourceRows, query, filters]);
  function exportCsv() {
    const header = definition.columns.map(column => column.label);
    const body = rows.map(row => definition.columns.map(column => csvCell(row[column.key])).join(","));
    const csv = [header.map(csvCell).join(","), ...body].join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${definition.title.toLocaleLowerCase("vi").replaceAll(" ", "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return <><Panel title={`${definition.title} (${rows.length})`} subtitle="Dữ liệu được cập nhật từ các giao dịch trong kho." action={<div className="module-actions"><button className="button" onClick={exportCsv}><Download size={14}/> Xuất CSV</button>{definition.addLabel && <button className="button primary" onClick={onAdd}><Plus size={15}/>{definition.addLabel}</button>}</div>}>
      <div className="table-toolbar"><label className="search-box"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={definition.searchPlaceholder}/></label>{definition.filters?.map(filter => { const key = filterKey(filter, definition.rows); const options = Array.from(new Set(sourceRows.map(row => row[key]).filter(value => value !== undefined).map(String))); return <label className="filter-select-wrap" key={filter}><SlidersHorizontal size={13}/><select className="filter-select" aria-label={filter} value={filters[key] ?? ""} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}><option value="">{filter}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>; })}</div>
      {apiError && <div className="module-note"><span>!</span>Không kết nối được API: {apiError}. Đang hiển thị dữ liệu mẫu.</div>}
      {rows.length ? <div className="table-wrap"><table><thead><tr>{definition.columns.map(column => <th key={column.key}>{column.label}</th>)}<th/></tr></thead><tbody>{rows.map(row => <DataTableRow key={row.id} row={row} definition={definition} section={section} confirming={confirming === row.id} onConfirm={section === "receipts" ? handleConfirm : undefined} onTransferAction={section === "transfers" ? handleTransferAction : undefined} onDispatchOrder={section === "dispatches" ? handleDispatchOrder : undefined} onCancel={section === "receipts" || section === "transfers" ? handleCancel : undefined}/>)}</tbody></table></div> : <EmptyState text="Không tìm thấy dữ liệu phù hợp."/>}
      {definition.note && <div className="module-note"><span>i</span>{definition.note}</div>}
    </Panel></>;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function filterKey(label: string, rows: DataRow[]) {
  const value = label.toLocaleLowerCase("vi");
  if (value.includes("trạng thái") || value.includes("tình trạng")) return "status";
  if (value.includes("kho nhập")) return "warehouse";
  if (value.includes("kho nhận")) return "to";
  if (value.includes("kho")) return "warehouse";
  if (value.includes("khu vực")) return rows.some(row => row.area !== undefined) ? "area" : "location";
  if (value.includes("danh mục")) return "category";
  if (value.includes("loại phiếu")) return "type";
  if (value.includes("loại giao dịch")) return "type";
  if (value.includes("khoảng ngày")) return "created";
  return "status";
}

function DataTableRow({ row, definition, section, confirming, onConfirm, onTransferAction, onDispatchOrder, onCancel }: { row: DataRow; definition: ModuleDefinition; section: string; confirming?: boolean; onConfirm?: (row: DataRow) => void; onTransferAction?: (row: DataRow) => void; onDispatchOrder?: (row: DataRow) => void; onCancel?: (row: DataRow) => void }) {
  return <tr>{definition.columns.map(column => { const value = row[column.key] ?? "—";
    if (column.kind === "product") return <td key={column.key}><span className="product-cell"><span className="product-thumb">▤</span><span><strong>{row.name}</strong><small>{row.code}</small></span></span></td>;
    if (column.kind === "status") return <td key={column.key}><StatusBadge value={value}/></td>;
    if (column.kind === "link") return <td key={column.key}><Link className="record-link" href={`/${section}/${row.id}`}>{String(value)}</Link></td>;
    return <td key={column.key} className={column.kind === "strong" ? "strong-value" : ""}>{value}</td>;
  })}<td className="row-actions"><Link className="row-link" href={`/${section}/${row.id}`} aria-label={`Xem ${row.id}`}><ArrowRight size={15}/></Link>{onConfirm && row.status !== "Đã nhập" && row.status !== "Đã hủy" && <button className="row-link" type="button" onClick={() => onConfirm(row)} disabled={confirming} aria-label={`Xác nhận ${row.id}`} title={confirming ? "Đang xác nhận" : "Xác nhận nhập"}><CheckCircle2 size={15}/></button>}{onTransferAction && ["Nháp", "Đang chuyển"].includes(String(row.status)) && Number.isInteger(Number(row.recordId)) && <button className="row-link" type="button" onClick={() => onTransferAction(row)} disabled={confirming} aria-label={`${row.status === "Nháp" ? "Giao" : "Nhận"} ${row.id}`} title={confirming ? "Đang cập nhật" : row.status === "Nháp" ? "Giao hàng" : "Xác nhận nhận hàng"}><CheckCircle2 size={15}/></button>}{onDispatchOrder && ["Chờ xử lý", "Đã xác nhận", "Đang soạn"].includes(String(row.status)) && <button className="row-link" type="button" onClick={() => onDispatchOrder(row)} disabled={confirming} aria-label={`Xuất ${row.id}`} title={confirming ? "Đang xuất" : "Xuất kho theo đơn"}><CheckCircle2 size={15}/></button>}{onCancel && row.status === "Nháp" && Number.isInteger(Number(row.recordId)) && <button className="row-link" type="button" onClick={() => onCancel(row)} disabled={confirming} aria-label={`Hủy ${row.id}`} title={confirming ? "Đang hủy" : "Hủy phiếu nháp"}><Ban size={15}/></button>}</td></tr>;
}
