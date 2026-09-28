"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Pencil, Package } from "lucide-react";
import { modules, moduleNames } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";
import { StatusBadge } from "@/src/components/warehouse/ui";

export default function DetailView({ section, id, edit = false }: { section: string; id: string; edit?: boolean }) {
  const router = useRouter(); const [saved, setSaved] = useState(false);
  const definition = modules[section as ModuleKey]; const row = definition?.rows.find(item => item.id === id);
  if (!definition || !row) return <div className="not-found"><Package size={22}/><h1>Không tìm thấy bản ghi</h1><Link href={`/${section}`} className="button">Quay lại danh sách</Link></div>;
  const fields = Object.entries(row).filter(([key]) => key !== "code");
  return <><div className="page-heading"><div><Link className="back-link" href={`/${section}`}><ArrowLeft size={14}/> {moduleNames[section as ModuleKey]}</Link><h1>{edit ? `Chỉnh sửa ${row.id}` : `Chi tiết ${row.id}`}</h1></div><div className="detail-actions"><Link className="button" href={`/${section}`}><ArrowLeft size={14}/> Quay lại</Link><Link className="button primary" href={`/${section}/${id}/edit`}><Pencil size={14}/> Chỉnh sửa</Link></div></div>
    <section className="form-panel"><div className="form-panel-head"><h2>Thông tin {moduleNames[section as ModuleKey]?.toLocaleLowerCase("vi")}</h2><p>Mã bản ghi <strong>{id}</strong></p></div>{edit ? <form onSubmit={event => { event.preventDefault(); setSaved(true); window.setTimeout(() => router.push(`/${section}/${id}`), 900); }}><div className="form-grid">{fields.map(([key, value]) => <label key={key}><span>{definition.columns.find(col => col.key === key)?.label ?? key.toLocaleUpperCase("vi")}</span><input defaultValue={String(value)} readOnly={key === "id"} /></label>)}</div><div className="form-actions"><Link className="button" href={`/${section}/${id}`}>Hủy</Link><button className="button primary" type="submit">{saved ? "Đã lưu" : "Lưu thay đổi"}</button></div></form> : <div className="detail-grid">{fields.map(([key, value]) => <div className="detail-field" key={key}><span>{definition.columns.find(col => col.key === key)?.label ?? key.toLocaleUpperCase("vi")}</span>{key === "status" ? <StatusBadge value={value}/> : <strong>{value}</strong>}</div>)}</div>}</section></>;
}
