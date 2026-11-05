"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { createManualInvoice, getWarehouseOptions, type ManualInvoiceLine, type ProductOption } from "@/src/lib/warehouse-api";

type DraftLine = { sku: string; quantity: string; unitPrice: string; discount: string };
const blankLine = (): DraftLine => ({ sku: "", quantity: "1", unitPrice: "", discount: "0" });
const numberValue = (value: string) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const money = (value: number) => `${new Intl.NumberFormat("vi-VN").format(Math.max(0, value))} ₫`;

export default function ManualInvoiceForm() {
  const [buyer, setBuyer] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    getWarehouseOptions().then(result => setProducts(result.products)).catch(err => setError(err instanceof Error ? err.message : "Không tải được danh sách sản phẩm.")).finally(() => setProductsLoading(false));
  }, []);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + numberValue(line.quantity) * numberValue(line.unitPrice), 0);
    const discount = lines.reduce((sum, line) => sum + numberValue(line.discount), 0);
    const beforeTax = Math.max(0, subtotal - discount);
    const tax = Math.round(beforeTax * 0.1 * 100) / 100;
    return { subtotal, discount, beforeTax, tax, total: beforeTax + tax };
  }, [lines]);

  function updateLine(index: number, key: keyof DraftLine, value: string) {
    setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  }

  function selectProduct(index: number, sku: string) {
    const product = products.find(item => item.sku === sku);
    setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, sku, unitPrice: product?.gia_ban_hien_tai == null ? line.unitPrice : String(product.gia_ban_hien_tai), discount: line.discount || "0" } : line));
  }

  function validate(): ManualInvoiceLine[] {
    if (!buyer.trim()) throw new Error("Nhập tên khách hàng.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Nhập email khách hàng hợp lệ.");
    if (!lines.length) throw new Error("Thêm ít nhất một sản phẩm.");
    return lines.map((line, index) => {
      const quantity = Number(line.quantity); const unitPrice = Number(line.unitPrice); const discount = Number(line.discount || 0);
      if (!line.sku.trim()) throw new Error(`Dòng ${index + 1}: nhập SKU sản phẩm.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Dòng ${index + 1}: số lượng phải là số nguyên dương.`);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error(`Dòng ${index + 1}: đơn giá không hợp lệ.`);
      if (!Number.isFinite(discount) || discount < 0 || discount > quantity * unitPrice) throw new Error(`Dòng ${index + 1}: giảm giá không được lớn hơn thành tiền.`);
      return { sku: line.sku.trim(), quantity, unit_price: unitPrice, discount };
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    try { setSaving(true); const payload = validate(); const result = await createManualInvoice({ buyer: buyer.trim(), email: email.trim().toLowerCase(), tax_id: taxId.trim() || undefined, address: address.trim() || undefined, lines: payload }); setSuccess(`Đã lập hóa đơn ${result.data.id}.`); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể lập hóa đơn."); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading"><div><Link className="back-link" href="/invoices"><ArrowLeft size={14}/> Hóa đơn</Link><h1>Lập hóa đơn</h1></div></div>
    <section className="form-panel invoice-create-panel"><div className="form-panel-head"><h2>Thông tin hóa đơn</h2><p>Nhập trực tiếp thông tin khách hàng và sản phẩm. Không cần tra cứu đơn hàng.</p></div>
      <form onSubmit={submit}>
        <div className="form-grid invoice-form-grid"><label><span>Tên khách hàng</span><input value={buyer} onChange={event => setBuyer(event.target.value)} placeholder="Nhập tên khách hàng" /></label><label><span>Email khách hàng</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Nhập email khách hàng" /></label><label><span>Mã số thuế <small>(không bắt buộc)</small></span><input value={taxId} onChange={event => setTaxId(event.target.value)} placeholder="Nhập mã số thuế" /></label><label className="wide"><span>Địa chỉ khách hàng <small>(không bắt buộc)</small></span><textarea value={address} onChange={event => setAddress(event.target.value)} placeholder="Nhập địa chỉ khách hàng" /></label></div>
        <div className="invoice-manual-lines"><div className="invoice-section-title"><div><h2>Sản phẩm hóa đơn</h2><p>Chọn sản phẩm từ database để tự điền tên, SKU, đơn vị và đơn giá.</p></div><button type="button" className="button" onClick={() => setLines(current => [...current, blankLine()])}><Plus size={15}/> Thêm dòng</button></div><div className="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>SKU</th><th>ĐƠN VỊ</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ (₫)</th><th>GIẢM GIÁ (₫)</th><th>THÀNH TIỀN</th><th></th></tr></thead><tbody>{lines.map((line, index) => { const amount = numberValue(line.quantity) * numberValue(line.unitPrice) - numberValue(line.discount); const product = products.find(item => item.sku === line.sku); return <tr key={index}><td><select className="product-select" value={line.sku} onChange={event => selectProduct(index, event.target.value)} required><option value="">{productsLoading ? "Đang tải sản phẩm…" : "Chọn sản phẩm"}</option>{products.map(item => <option key={item.sku} value={item.sku}>{item.ten_sp}</option>)}</select></td><td><strong>{product?.sku ?? "—"}</strong></td><td>{product?.don_vi ?? "—"}</td><td><input type="number" min="1" step="1" value={line.quantity} onChange={event => updateLine(index, "quantity", event.target.value)} required /><small className="stock-hint">Tồn: {product?.so_luong_ton ?? "—"}</small></td><td><input type="number" min="0" step="0.01" value={line.unitPrice} onChange={event => updateLine(index, "unitPrice", event.target.value)} placeholder="0" required /></td><td><input type="number" min="0" step="0.01" value={line.discount} onChange={event => updateLine(index, "discount", event.target.value)} /></td><td className="line-total">{money(amount)}</td><td><button type="button" className="icon-button" title="Xóa dòng" onClick={() => setLines(current => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 size={16}/></button></td></tr>; })}</tbody></table></div></div>
        <div className="invoice-summary"><span>Tổng trước thuế <strong>{money(totals.beforeTax)}</strong></span><span>Giảm giá <strong>{money(totals.discount)}</strong></span><span>Tiền thuế (10%) <strong>{money(totals.tax)}</strong></span><span className="invoice-total">Tổng thanh toán <strong>{money(totals.total)}</strong></span></div>
        {error && <div className="module-note form-error">{error}</div>}{success && <div className="module-note form-success">{success}</div>}<div className="form-actions"><Link href="/invoices" className="button"><ArrowLeft size={14}/> Quay lại</Link><button className="button primary" type="submit" disabled={saving}><Save size={14}/>{saving ? "Đang lập hóa đơn…" : "Lập hóa đơn"}</button></div>
      </form>
    </section>
  </>;
}
