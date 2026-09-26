"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { formFields, moduleNames } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";

export default function FormView({ section }: { section: string }) {
  const router = useRouter(); const key = section as ModuleKey; const [saved, setSaved] = useState(false);
  const fields = formFields[key] ?? [];
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSaved(true); window.setTimeout(() => router.push(`/${section}`), 900); }
  return <><div className="page-heading"><div><h1>{formFields[key] ? `Tạo ${moduleNames[key]?.toLocaleLowerCase("vi") ?? "phiếu"}` : "Tạo mới"}</h1><p>Nhập thông tin nghiệp vụ trước khi lưu phiếu.</p></div></div><section className="form-panel"><div className="form-panel-head"><h2>Thông tin phiếu</h2><p>Các trường thông tin sẽ được dùng để theo dõi hoạt động kho.</p></div><form onSubmit={submit}><div className="form-grid">{fields.map(field => <label className={field.wide ? "wide" : ""} key={field.name}><span>{field.label}</span>{field.type === "textarea" ? <textarea required placeholder={field.placeholder}/> : <input required type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder}/>}</label>)}</div><div className="form-actions"><Link href={`/${section}`} className="button"><ArrowLeft size={14}/> Quay lại</Link><button className="button primary" type="submit"><Save size={14}/>{saved ? "Đã lưu" : "Lưu phiếu nháp"}</button></div></form></section></>;
}
