"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Download, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Panel, StatusBadge, EmptyState } from "@/src/components/warehouse/ui";
import type { DataRow, ModuleDefinition } from "@/src/types/warehouse";

export default function ModuleView({ definition, section, onAdd }: { definition: ModuleDefinition; section: string; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const rows = useMemo(() => definition.rows.filter(row => Object.values(row).some(value => String(value).toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))) && Object.entries(filters).every(([filter, value]) => !value || String(row[filter] ?? "").toLocaleLowerCase("vi") === value.toLocaleLowerCase("vi"))), [definition.rows, query, filters]);
  return <><Panel title={`${definition.title} (${rows.length})`} subtitle="Dữ liệu được cập nhật từ các giao dịch trong kho." action={<div className="module-actions"><button className="button" onClick={() => window.print()}><Download size={14}/> Xuất danh sách</button>{definition.addLabel && <button className="button primary" onClick={onAdd}><Plus size={15}/>{definition.addLabel}</button>}</div>}>
      <div className="table-toolbar"><label className="search-box"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={definition.searchPlaceholder}/></label>{definition.filters?.map(filter => { const key = filterKey(filter, definition.rows); const options = Array.from(new Set(definition.rows.map(row => row[key]).filter(value => value !== undefined).map(String))); return <label className="filter-select-wrap" key={filter}><SlidersHorizontal size={13}/><select className="filter-select" aria-label={filter} value={filters[key] ?? ""} onChange={event => setFilters(current => ({ ...current, [key]: event.target.value }))}><option value="">{filter}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>; })}</div>
      {rows.length ? <div className="table-wrap"><table><thead><tr>{definition.columns.map(column => <th key={column.key}>{column.label}</th>)}<th/></tr></thead><tbody>{rows.map(row => <DataTableRow key={row.id} row={row} definition={definition} section={section}/>)}</tbody></table></div> : <EmptyState text="Không tìm thấy dữ liệu phù hợp."/>}
      {definition.note && <div className="module-note"><span>i</span>{definition.note}</div>}
    </Panel></>;
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

function DataTableRow({ row, definition, section }: { row: DataRow; definition: ModuleDefinition; section: string }) {
  return <tr>{definition.columns.map(column => { const value = row[column.key] ?? "—";
    if (column.kind === "product") return <td key={column.key}><span className="product-cell"><span className="product-thumb">▤</span><span><strong>{row.name}</strong><small>{row.code}</small></span></span></td>;
    if (column.kind === "status") return <td key={column.key}><StatusBadge value={value}/></td>;
    if (column.kind === "link") return <td key={column.key}><Link className="record-link" href={`/${section}/${row.id}`}>{String(value)}</Link></td>;
    return <td key={column.key} className={column.kind === "strong" ? "strong-value" : ""}>{value}</td>;
  })}<td><Link className="row-link" href={`/${section}/${row.id}`} aria-label={`Xem ${row.id}`}><ArrowRight size={15}/></Link></td></tr>;
}
