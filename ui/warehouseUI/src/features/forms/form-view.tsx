"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { formFields, moduleNames } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";
import { createInvoice, createReceiptDraft, createTransferDraft, getInvoiceOptions, getWarehouseOptions, type InvoiceOption, type ProductOption, type SupplierOption, type WarehouseOption } from "@/src/lib/warehouse-api";

export default function FormView({ section }: { section: string }) {
  const key = section as ModuleKey; const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [saving, setSaving] = useState(false); const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]); const [suppliers, setSuppliers] = useState<SupplierOption[]>([]); const [products, setProducts] = useState<ProductOption[]>([]);
  const fields = formFields[key] ?? [];
  const workflowEnabled = section === "receipts" || section === "transfers" || section === "invoices";
  const [invoiceOptions, setInvoiceOptions] = useState<InvoiceOption[]>([]);
  useEffect(() => { if (section === "invoices") { getInvoiceOptions().then(setInvoiceOptions).catch(err => setError(err instanceof Error ? err.message : "Không tải được danh sách đơn hàng.")); return; } if (!workflowEnabled) return; getWarehouseOptions().then(result => { setWarehouses(result.warehouses); setSuppliers(result.suppliers); setProducts(result.products); }).catch(err => setError(err instanceof Error ? err.message : "Không tải được danh sách dữ liệu.")); }, [section, workflowEnabled]);
  function parseLines(value: string, receipt: boolean) {
    return value.split(",").map(item => item.trim()).filter(Boolean).map(item => {
      const parts = item.split(":").map(part => part.trim());
      const quantity = Number(parts[1]);
      const unitPrice = Number(parts[2] ?? 0);
      if (!parts[0] || !Number.isInteger(quantity) || quantity <= 0 || (receipt && (!Number.isFinite(unitPrice) || unitPrice < 0))) throw new Error(receipt ? "Sản phẩm phải có dạng SKU:Số lượng:Đơn giá." : "Sản phẩm phải có dạng SKU:Số lượng.");
      return receipt ? { sku: parts[0], quantity, unit_price: unitPrice } : { sku: parts[0], quantity };
    });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!workflowEnabled) { setError("Chức năng này chưa được triển khai."); return; }
    const form = new FormData(event.currentTarget);
    try {
      setSaving(true);
      const note = String(form.get("note") ?? "") || undefined;
      if (section === "invoices") {
        const result = await createInvoice({ order_id: String(form.get("order")), buyer: String(form.get("buyer") ?? "") || undefined, tax_id: String(form.get("taxId") ?? "") || undefined, address: String(form.get("address") ?? "") || undefined });
        setSuccess(`Đã lập hóa đơn ${result.data.id} · mã nhân viên ${result.data.employeeCode}.`);
      } else if (section === "receipts") {
        const result = await createReceiptDraft({ supplier_id: Number(form.get("supplier")), warehouse_id: Number(form.get("warehouse")), note, lines: parseLines(String(form.get("items") ?? ""), true) as { sku: string; quantity: number; unit_price: number }[] });
        setSuccess(`Đã tạo phiếu nhập ${result.data.ma_phieu_code}.`);
      } else {
        const result = await createTransferDraft({ source_warehouse_id: Number(form.get("from")), destination_warehouse_id: Number(form.get("to")), note, lines: parseLines(String(form.get("items") ?? ""), false) as { sku: string; quantity: number }[] });
        setSuccess(`Đã tạo phiếu chuyển #${result.data.ma_phieu_chuyen}.`);
      }
      event.currentTarget.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể lưu phiếu."); }
    finally { setSaving(false); }
  }
  function optionField(field: string) { if (field === "order") return <select name={field} required defaultValue=""><option value="" disabled>Chọn đơn hàng</option>{invoiceOptions.map(item => <option key={item.order_id} value={item.order_id}>{item.order_id} · {item.buyer} · {item.total.toLocaleString("vi-VN")} ₫</option>)}</select>; if (field === "supplier") return <select name={field} required defaultValue=""><option value="" disabled>Chọn nhà cung cấp</option>{suppliers.map(item => <option key={item.ma_ncc} value={item.ma_ncc}>{item.ten_ncc} (#{item.ma_ncc})</option>)}</select>; if (["warehouse", "from", "to"].includes(field)) return <select name={field} required defaultValue=""><option value="" disabled>Chọn kho</option>{warehouses.map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} (#{item.ma_kho})</option>)}</select>; return null; }
  return <><div className="page-heading"><div><h1>{formFields[key] ? `${section === "invoices" ? "Lập" : "Tạo"} ${moduleNames[key]?.toLocaleLowerCase("vi") ?? "phiếu"}` : "Tạo mới"}</h1></div></div><section className="form-panel"><div className="form-panel-head"><h2>Thông tin {section === "invoices" ? "hóa đơn" : "phiếu"}</h2><p>{section === "invoices" ? "Chọn đơn hàng đã xuất kho. Mã nhân viên được lấy tự động từ tài khoản đăng nhập." : "Chọn dữ liệu thật từ backend và nhập các dòng hàng theo định dạng bên dưới."}</p></div>{workflowEnabled && section !== "invoices" && <div className="module-note"><AlertCircle size={16}/><span>Phiếu nhập: sản phẩm dạng <code>SKU:Số lượng:Đơn giá</code>. Chuyển kho: <code>SKU:Số lượng</code>. Nhiều sản phẩm cách nhau bằng dấu phẩy.</span></div>}{error && <div className="module-note"><AlertCircle size={16}/><span>{error}</span></div>}{success && <div className="module-note"><span>{success}</span></div>}<form onSubmit={submit}><div className="form-grid">{fields.map(field => <label className={field.wide ? "wide" : ""} key={field.name}><span>{field.label}</span>{field.type === "textarea" ? <textarea name={field.name} placeholder={field.placeholder}/> : field.name === "items" ? <><input name={field.name} list="warehouse-product-skus" required type="text" placeholder={field.placeholder}/><datalist id="warehouse-product-skus">{products.map(item => <option key={item.sku} value={item.ten_sp}>{item.ten_sp}</option>)}</datalist></> : optionField(field.name) ?? <input name={field.name} required={field.name === "buyer" ? false : true} type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder}/>}</label>)}</div><div className="form-actions"><Link href={`/${section}`} className="button"><ArrowLeft size={14}/> Quay lại</Link><button className="button primary" disabled={saving} type="submit"><Save size={14}/>{saving ? "Đang lưu…" : section === "invoices" ? "Lập hóa đơn" : "Lưu phiếu nháp"}</button></div></form></section></>;
}
