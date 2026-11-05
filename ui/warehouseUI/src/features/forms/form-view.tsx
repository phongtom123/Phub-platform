"use client";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, PackagePlus, Search, Save, Trash2, Truck, UserRound } from "lucide-react";
import Link from "next/link";
import { formFields, moduleNames } from "@/src/data/warehouse-data";
import type { ModuleKey } from "@/src/types/warehouse";
import { confirmDispatch, createDispatchDraft, createInvoice, createReceiptDraft, createTransferDraft, dispatchOrder, getDispatchOrderOptions, getInvoiceOrderPreview, getWarehouseOptions, searchInvoiceCustomers, type CustomerInvoiceSearch, type DispatchOrderOption, type InvoiceOrderPreview, type ProductOption, type SupplierOption, type WarehouseOption } from "@/src/lib/warehouse-api";
import ManualInvoiceForm from "./manual-invoice-form";
import LookupSelect from "../receipts/lookup-select";

export default function FormView({ section }: { section: string }) {
  if (section === "invoices") return <ManualInvoiceForm />;
  if (section === "dispatches") return <DispatchForm />;
  return <GenericFormView section={section} />;
}

function DispatchForm() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [orders, setOrders] = useState<DispatchOrderOption[]>([]);
  const [order, setOrder] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [lines, setLines] = useState<{ ma_sp: string; sku: string; name: string; unit: string; unit_price: number; quantity: number; amount: number }[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => { getWarehouseOptions().then(result => setProducts(result.products)).catch(err => setError(err instanceof Error ? err.message : "Không tải được dữ liệu lập phiếu xuất.")); }, []);
  async function chooseProductBySku(value: string, productRow?: Record<string, string | number | null>) {
    setSku(value); setError(""); if (!value) { setOrders([]); setOrder(""); return; }
    try {
      const result = await getDispatchOrderOptions(value);
      const selected = result[0];
      setOrders(result);
      setOrder(selected?.order_id ?? "");
      if (!selected) { setError("Sản phẩm chưa thuộc đơn hàng đủ điều kiện xuất."); return; }
      const nextQuantity = selected.ordered_quantity || 1;
      setQuantity(nextQuantity);
      const product = products.find(item => item.sku === value);
      if (lines.some(line => line.sku === value)) { setError("Sản phẩm đã có trong danh sách."); return; }
      if (lines.length && order && order !== selected.order_id) { setError("Các sản phẩm phải thuộc cùng một đơn hàng."); return; }
      const unitPrice = Number(selected.unit_price ?? 0);
      setLines(current => [...current, { ma_sp: String(productRow?.ma_sp ?? product?.ma_sp ?? "—"), sku: value, name: String(productRow?.ten_sp ?? product?.ten_sp ?? value), unit: String(selected.unit ?? productRow?.don_vi ?? product?.don_vi ?? "—"), unit_price: unitPrice, quantity: nextQuantity, amount: nextQuantity * unitPrice }]);
      setSku("");
      setError("");
    }
    catch (err) { setError(err instanceof Error ? err.message : "Không tìm được đơn hàng của sản phẩm."); }
  }
  function addLine() {
    if (!sku || !order || !Number.isInteger(quantity) || quantity <= 0) { setError("Chọn sản phẩm, mã đơn hàng và số lượng hợp lệ."); return; }
    if (!orders.find(item => item.order_id === order)?.dispatchable) { setError("Đơn hàng này đã xử lý hoặc đã xuất kho, không thể tạo phiếu mới."); return; }
    const product = products.find(item => item.sku === sku); const orderLine = orders.find(item => item.order_id === order); const unitPrice = Number(orderLine?.unit_price ?? 0);
    setLines(current => { const existing = current.find(item => item.sku === sku); return existing ? current.map(item => item.sku === sku ? { ...item, quantity: item.quantity + quantity, amount: (item.quantity + quantity) * item.unit_price } : item) : [...current, { ma_sp: product?.ma_sp ?? "—", sku, name: product?.ten_sp ?? sku, unit: orderLine?.unit ?? product?.don_vi ?? "—", unit_price: unitPrice, quantity, amount: quantity * unitPrice }]; });
    setSku(""); setQuantity(1); setError("");
  }
  async function saveDraft(dispatchNow = false) {
    setError(""); setSuccess("");
    if (!order || !lines.length) { setError("Hãy chọn ít nhất một sản phẩm hợp lệ."); return; }
    if (lines.some(line => !Number.isInteger(line.quantity) || line.quantity <= 0)) { setError("Số lượng phải là số nguyên lớn hơn 0."); return; }
    try { setSaving(true); const result = await createDispatchDraft({ order_id: order, note: note.trim() || undefined, lines: lines.map(line => ({ sku: line.sku, quantity: line.quantity })) }); if (dispatchNow) { await confirmDispatch(result.data.ma_phieu_xuat); setSuccess(`Đã lưu và xuất kho ${result.data.ma_phieu_code}.`); } else setSuccess(`Đã lưu phiếu xuất nháp ${result.data.ma_phieu_code}.`); setLines([]); setOrder(""); setOrders([]); setNote(""); }
    catch (err) {
      const message = err instanceof Error ? err.message : "Không thể tạo phiếu xuất.";
      if (dispatchNow && /PHIEU_XUAT|create_dispatch_document|schema cache/i.test(message)) {
        try { await dispatchOrder(order); setSuccess(`Đã xuất kho đơn hàng ${order}. Phiếu xuất chi tiết sẽ có sau khi áp dụng migration database.`); setLines([]); setOrder(""); setOrders([]); setNote(""); }
        catch (fallbackError) { setError(fallbackError instanceof Error ? fallbackError.message : message); }
      } else setError(message);
    } finally { setSaving(false); }
  }
  function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); void saveDraft(false); }
  const money = (value: number) => `${value.toLocaleString("vi-VN")} ₫`;
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalValue = lines.reduce((sum, line) => sum + line.amount, 0);
  async function chooseProduct(row: Record<string, string | number | null>) { await chooseProductBySku(String(row.sku), row); }
  return <section className="warehouse-workspace receipt-form-workspace">
    <nav className="warehouse-breadcrumb"><Link href="/">Tổng quan</Link><span>›</span><Link href="/dispatches">Phiếu xuất</Link><span>›</span><strong>Tạo mới</strong></nav>
    <div className="receipt-form-hero"><div><span className="receipt-eyebrow"><Truck size={14}/> NGHIỆP VỤ KHO</span><h1>Tạo phiếu xuất</h1><p>Chọn sản phẩm trong đơn hàng, kiểm tra số lượng trước khi lưu phiếu nháp.</p></div><Link className="button" href="/dispatches"><ArrowLeft size={15}/> Quay lại</Link></div>
    <form onSubmit={submit} className="receipt-form-card"><fieldset disabled={saving} className="warehouse-fields">
      <div className="receipt-section-heading"><span className="receipt-step">01</span><div><h2>Danh sách sản phẩm xuất</h2><p>Chọn sản phẩm, số lượng và kiểm tra thông tin trước khi lưu.</p></div></div>
      <label className="warehouse-field"><span>Ghi chú xuất hàng <small>(không bắt buộc)</small></span><textarea maxLength={2000} rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="Ví dụ: Xuất đủ số lượng giao khách…" /></label>
      <LookupSelect resource="products" label="Thêm sản phẩm xuất" onSelect={row => void chooseProduct(row)} disabled={lines.length >= 100} />
      <div className="receipt-summary-strip"><span><PackagePlus size={16}/> {lines.length} SKU</span><span>{totalQuantity.toLocaleString("vi-VN")} sản phẩm</span><strong>{money(totalValue)}</strong></div>
      <div className="warehouse-table receipt-lines-table"><table><thead><tr><th>SẢN PHẨM / SKU</th><th>ĐƠN VỊ</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>THÀNH TIỀN</th><th /></tr></thead><tbody>{lines.map((line, index) => <tr key={line.sku}><td><strong>{line.name}</strong><small>{line.sku}</small></td><td>{line.unit}</td><td><input aria-label={`Số lượng ${line.sku}`} type="number" min={1} step={1} value={line.quantity} onChange={event => { const quantity = Number(event.target.value); setLines(current => current.map((item, i) => i === index ? { ...item, quantity, amount: quantity * item.unit_price } : item)); }} /></td><td>{money(line.unit_price)}</td><td className="receipt-line-total">{money(line.amount)}</td><td><button className="icon-button receipt-remove" title="Bỏ sản phẩm" type="button" onClick={() => setLines(current => current.filter(item => item.sku !== line.sku))}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!lines.length && <div className="warehouse-empty receipt-empty"><PackagePlus size={24}/><strong>Chưa có sản phẩm</strong><span>Dùng ô “Thêm sản phẩm xuất” phía trên để bắt đầu.</span></div>}</div>
      <div className="receipt-form-footer"><div><strong>Phiếu xuất</strong><span>Tồn kho chỉ giảm sau khi xác nhận xuất kho.</span></div><div className="warehouse-toolbar"><Link className="button" href="/dispatches">Hủy</Link><button className="button" type="submit" disabled={!lines.length}><Save size={15}/>{saving ? "Đang lưu…" : "Lưu phiếu nháp"}</button><button className="button primary" type="button" disabled={!lines.length || saving} onClick={() => void saveDraft(true)}><CheckCircle2 size={15}/>{saving ? "Đang xử lý…" : "Lưu và xuất kho"}</button></div></div>
    </fieldset>{error && <p className="warehouse-error" role="alert">{error}</p>}{success && <p className="warehouse-info" role="status">{success}</p>}</form>
  </section>;
}

function GenericFormView({ section }: { section: string }) {
  const key = section as ModuleKey; const fields = formFields[key] ?? []; const workflow = ["receipts", "transfers", "dispatches", "invoices"].includes(section);
  const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [saving, setSaving] = useState(false); const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]); const [suppliers, setSuppliers] = useState<SupplierOption[]>([]); const [products, setProducts] = useState<ProductOption[]>([]); const [customerQuery, setCustomerQuery] = useState(""); const [customerResults, setCustomerResults] = useState<CustomerInvoiceSearch>({ customers: [], orders: [] }); const [selectedOrder, setSelectedOrder] = useState("");
  useEffect(() => { if (workflow && section !== "invoices") getWarehouseOptions().then(result => { setWarehouses(result.warehouses); setSuppliers(result.suppliers); setProducts(result.products); }).catch(err => setError(err instanceof Error ? err.message : "Không tải được dữ liệu.")); }, [section, workflow]);
  function parseLines(value: string, receipt: boolean) { return value.split(",").map(item => item.trim()).filter(Boolean).map(item => { const [sku, quantityText, priceText] = item.split(":").map(value => value.trim()); const quantity = Number(quantityText); const price = Number(priceText ?? 0); if (!sku || !Number.isInteger(quantity) || quantity <= 0 || (receipt && (!Number.isFinite(price) || price < 0))) throw new Error(receipt ? "Dòng nhập phải có dạng SKU:Số lượng:Đơn giá." : "Dòng hàng phải có dạng SKU:Số lượng."); return receipt ? { sku, quantity, unit_price: price } : { sku, quantity }; }); }
  async function lookupCustomer() { const email = customerQuery.trim().toLowerCase(); setError(""); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Nhập email khách hàng hợp lệ."); return; } try { setCustomerResults(await searchInvoiceCustomers(email)); } catch (err) { setError(err instanceof Error ? err.message : "Không tra cứu được khách hàng."); } }
  async function selectDispatchProduct(sku: string) { setError(""); setSelectedOrder(""); if (!sku) return; try { const orders = await getDispatchOrderOptions(sku); if (!orders.length) throw new Error("Không tìm thấy đơn hàng phù hợp với sản phẩm này."); setSelectedOrder(orders[0].order_id); } catch (err) { setError(err instanceof Error ? err.message : "Không tìm được mã đơn hàng."); } }
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setSuccess(""); const form = new FormData(event.currentTarget); try { setSaving(true); const note = String(form.get("note") ?? "") || undefined; if (section === "invoices") { if (!selectedOrder) throw new Error("Hãy tra cứu và chọn một đơn hàng trước."); const result = await createInvoice({ order_id: selectedOrder, buyer: String(form.get("buyer") ?? "") || undefined, tax_id: String(form.get("taxId") ?? "") || undefined, address: String(form.get("address") ?? "") || undefined }); setSuccess(`Đã lập hóa đơn ${result.data.id}.`); } else if (section === "receipts") { const result = await createReceiptDraft({ supplier_id: Number(form.get("supplier")), warehouse_id: Number(form.get("warehouse")), note, lines: parseLines(String(form.get("items") ?? ""), true) as { sku: string; quantity: number; unit_price: number }[] }); setSuccess(`Đã tạo phiếu nhập ${result.data.ma_phieu_code}.`); } else if (section === "dispatches") { if (!selectedOrder) throw new Error("Hãy chọn sản phẩm để lấy mã đơn hàng."); const sku = String(form.get("dispatchProduct") ?? ""); const quantity = Number(form.get("dispatchQuantity")); if (!sku || !Number.isInteger(quantity) || quantity <= 0) throw new Error("Chọn sản phẩm và nhập số lượng hợp lệ."); const result = await createDispatchDraft({ order_id: selectedOrder, note, lines: [{ sku, quantity }] }); setSuccess(`Đã tạo phiếu xuất ${result.data.ma_phieu_code}.`); } else { const result = await createTransferDraft({ source_warehouse_id: Number(form.get("from")), destination_warehouse_id: Number(form.get("to")), note, lines: parseLines(String(form.get("items") ?? ""), false) as { sku: string; quantity: number }[] }); setSuccess(`Đã tạo phiếu chuyển #${result.data.ma_phieu_chuyen}.`); } event.currentTarget.reset(); setSelectedOrder(""); } catch (err) { setError(err instanceof Error ? err.message : "Không thể lưu dữ liệu."); } finally { setSaving(false); } }
  function selectField(name: string) { if (name === "supplier") return <select name={name} required defaultValue=""><option value="" disabled>Chọn nhà cung cấp</option>{suppliers.map(item => <option key={item.ma_ncc} value={item.ma_ncc}>{item.ten_ncc}</option>)}</select>; if (["warehouse", "from", "to"].includes(name)) return <select name={name} required defaultValue=""><option value="" disabled>Chọn kho</option>{warehouses.map(item => <option key={item.ma_kho} value={item.ma_kho}>{item.ten_kho} (#{item.ma_kho})</option>)}</select>; if (name === "order" && (section === "invoices" || section === "dispatches")) return <input name={name} required value={selectedOrder} readOnly placeholder={section === "dispatches" ? "Mã đơn hàng tự điền sau khi chọn sản phẩm" : "Chọn đơn hàng sau khi tra cứu email"} />; return null; }
  return <><div className="page-heading"><div><h1>{section === "invoices" ? "Lập hóa đơn" : `Tạo ${moduleNames[key]?.toLocaleLowerCase("vi") ?? "mới"}`}</h1></div></div><section className="form-panel"><div className="form-panel-head"><h2>Thông tin {section === "invoices" ? "hóa đơn" : "phiếu"}</h2><p>{section === "invoices" ? "Nhập email tài khoản khách hàng để tra cứu và chọn đơn hàng đủ điều kiện." : "Nhập dữ liệu và lưu dưới dạng nháp để tiếp tục chỉnh sửa trước khi xác nhận."}</p></div>{section === "invoices" && <div className="invoice-lookup"><label className="search-box"><input type="email" value={customerQuery} onChange={event => setCustomerQuery(event.target.value)} placeholder="Email khách hàng" /></label><button className="button" type="button" onClick={() => void lookupCustomer()}>Tra cứu</button><div className="invoice-results">{customerResults.customers.map(customer => <span className="module-note" key={customer.ma_kh}>{customer.ten_kh} · {customer.ma_kh}</span>)}{customerResults.orders.map(order => <button className={`button ${selectedOrder === order.ma_donhang ? "primary" : ""}`} type="button" key={order.ma_donhang} onClick={() => setSelectedOrder(order.ma_donhang)}>Đơn {order.ma_donhang} · {order.ten_nguoi_nhan ?? "Khách hàng"}</button>)}</div></div>}{section !== "invoices" && <div className="module-note form-help"><AlertCircle size={16}/><span>{section === "dispatches" ? "Chọn sản phẩm để tự tìm mã đơn hàng; sau đó nhập số lượng cần xuất." : <><span>Dòng hàng: <code>SKU:Số lượng:Đơn giá</code> với phiếu nhập; <code>SKU:Số lượng</code> với phiếu xuất.</span></>}</span></div>}{error && <div className="module-note form-error">{error}</div>}{success && <div className="module-note">{success}</div>}<form onSubmit={submit}><div className="form-grid">{fields.map(field => <label className={field.wide ? "wide" : ""} key={field.name}><span>{field.label}</span>{field.type === "textarea" ? <textarea name={field.name} placeholder={field.placeholder}/> : field.name === "items" && section === "dispatches" ? <><select name="dispatchProduct" required defaultValue="" onChange={event => void selectDispatchProduct(event.target.value)}><option value="">Chọn sản phẩm</option>{products.map(item => <option key={item.sku} value={item.sku}>{item.ten_sp} · {item.sku}</option>)}</select><input name="dispatchQuantity" type="number" min="1" step="1" required placeholder="Số lượng cần xuất" /><small className="field-hint">Mã đơn hàng sẽ tự điền theo sản phẩm đã chọn.</small></> : field.name === "items" ? <><input className="line-input" name={field.name} list="warehouse-product-skus" required placeholder={field.placeholder}/><small className="field-hint">Mỗi dòng: SKU:Số lượng{section === "receipts" ? ":Đơn giá" : ""}; phân tách bằng dấu phẩy.</small><datalist id="warehouse-product-skus">{products.map(item => <option key={item.sku} value={item.sku}>{item.ten_sp}</option>)}</datalist></> : selectField(field.name) ?? <input name={field.name} required={field.name !== "buyer" && field.name !== "taxId" && field.name !== "address"} type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder}/>}</label>)}</div><div className="form-actions"><Link href={`/${section}`} className="button"><ArrowLeft size={14}/> Quay lại</Link><button className="button primary" disabled={saving}><Save size={14}/>{saving ? "Đang lưu…" : "Lưu"}</button></div></form></section></>;
}

function InvoiceForm() {
  const [email, setEmail] = useState("");
  const [results, setResults] = useState<CustomerInvoiceSearch>({ customers: [], orders: [] });
  const [selectedOrder, setSelectedOrder] = useState("");
  const [preview, setPreview] = useState<InvoiceOrderPreview | null>(null);
  const [buyer, setBuyer] = useState(""); const [customerEmail, setCustomerEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const customer = results.customers[0];

  async function lookup() {
    const normalized = email.trim().toLowerCase();
    setError(""); setSuccess(""); setResults({ customers: [], orders: [] }); setPreview(null); setSelectedOrder(""); setCustomerEmail(normalized);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { setError("Nhập email khách hàng hợp lệ."); return; }
    try { setLoading(true); setResults(await searchInvoiceCustomers(normalized)); }
    catch (err) { setError(err instanceof Error ? err.message : "Không thể tra cứu khách hàng."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!selectedOrder) { setPreview(null); return; }
    let cancelled = false;
    setPreviewLoading(true); setError("");
    getInvoiceOrderPreview(selectedOrder).then(value => { if (!cancelled) { setPreview(value); setBuyer(value.order.ten_nguoi_nhan ?? ""); setAddress(value.order.dia_chi_chi_tiet ?? ""); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Không tải được chi tiết đơn hàng."); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [selectedOrder]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!selectedOrder) { setError("Hãy chọn một đơn hàng đủ điều kiện trước khi lập hóa đơn."); return; }
    try {
      setSaving(true);
      const result = await createInvoice({ order_id: selectedOrder, buyer: buyer.trim() || undefined, tax_id: taxId.trim() || undefined, address: address.trim() || undefined });
      setSuccess(`Đã lập hóa đơn ${result.data.id}. Hóa đơn đã được khóa theo đơn hàng.`);
      setResults(current => ({ ...current, orders: current.orders.filter(order => order.ma_donhang !== selectedOrder) }));
      setSelectedOrder(""); setPreview(null); setTaxId("");
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể lập hóa đơn."); }
    finally { setSaving(false); }
  }

  return <>
    <div className="page-heading"><div><Link className="back-link" href="/invoices"><ArrowLeft size={14}/> Hóa đơn</Link><h1>Lập hóa đơn</h1></div></div>
    <section className="form-panel invoice-create-panel"><div className="form-panel-head"><h2>Thông tin hóa đơn</h2><p>Tìm khách hàng bằng email, chọn đơn đã xuất kho và kiểm tra thông tin trước khi phát hành.</p></div><div className="invoice-workspace">
      <section className="invoice-card invoice-search-card"><div className="invoice-card-head"><span className="invoice-step">1</span><div><h2>Tìm khách hàng</h2><p>Chỉ sử dụng email tài khoản đã đăng ký để tránh nhầm khách hàng.</p></div></div><div className="invoice-search-row"><label className="search-box"><Search size={16}/><input type="email" value={email} onChange={event => setEmail(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void lookup(); } }} placeholder="Nhập email khách hàng…" /></label><button className="button primary" type="button" onClick={() => void lookup()} disabled={loading}>{loading ? "Đang tra cứu…" : "Tra cứu"}</button></div>{customer && <div className="invoice-customer"><span className="invoice-avatar"><UserRound size={18}/></span><div><strong>{customer.ten_kh}</strong><span>Email: {customer.email ?? customerEmail}</span><span>Mã khách hàng: {customer.ma_kh} · {customer.sdt ?? "Không có số điện thoại"}</span></div><CheckCircle2 size={18} color="var(--green)"/></div>}</section>
      <section className="invoice-card"><div className="invoice-card-head"><span className="invoice-step">2</span><div><h2>Chọn đơn hàng</h2><p>Chỉ hiển thị đơn đã xuất kho hoặc đã hoàn thành và chưa lập hóa đơn.</p></div></div>{results.orders.length ? <div className="invoice-order-list">{results.orders.map(order => <button className={`invoice-order-option ${selectedOrder === order.ma_donhang ? "selected" : ""}`} type="button" key={order.ma_donhang} onClick={() => setSelectedOrder(order.ma_donhang)}><span><strong>{order.ma_donhang}</strong><small>{order.ten_nguoi_nhan ?? "Khách hàng"}</small></span><span><em>{order.trang_thai === "HOAN_THANH" ? "Hoàn thành" : "Đã xuất kho"}</em>{selectedOrder === order.ma_donhang && <CheckCircle2 size={17}/>}</span></button>)}</div> : <div className="invoice-empty">{email ? "Chưa có đơn hàng đủ điều kiện cho email này." : "Nhập email và bấm Tra cứu để xem đơn hàng."}</div>}{previewLoading && <div className="module-note">Đang tải chi tiết đơn hàng…</div>}</section>
      <section className="invoice-card invoice-preview-card"><div className="invoice-card-head"><span className="invoice-step">3</span><div><h2>Kiểm tra nội dung hóa đơn</h2><p>Thông tin hiển thị giống trang chi tiết hóa đơn.</p></div></div>{preview ? <><div className="invoice-customer invoice-customer-detail"><div><strong>{buyer || "Chưa có tên người mua"}</strong><span>Email: {customerEmail || "—"}</span><span>Địa chỉ: {address || "—"}</span></div></div><InvoicePreviewTable preview={preview} /></> : <div className="invoice-empty">Nhập email, tra cứu và chọn đơn hàng để hiển thị sản phẩm, SKU, đơn vị, số lượng, đơn giá, giảm giá và thành tiền.</div>}</section>
      <section className="invoice-card"><div className="invoice-card-head"><span className="invoice-step">4</span><div><h2>Thông tin xuất hóa đơn</h2><p>Kiểm tra tên khách hàng, email và địa chỉ trước khi lập.</p></div></div><form onSubmit={submit}><div className="form-grid invoice-form-grid"><label><span>Tên khách hàng</span><input value={buyer} onChange={event => setBuyer(event.target.value)} placeholder="Nhập tên khách hàng" disabled={!preview}/></label><label><span>Email khách hàng</span><input type="email" value={customerEmail} readOnly placeholder="Email tài khoản" disabled={!preview}/></label><label><span>Mã số thuế <small>(không bắt buộc)</small></span><input value={taxId} onChange={event => setTaxId(event.target.value)} placeholder="Nhập mã số thuế" disabled={!preview}/></label><label className="wide"><span>Địa chỉ khách hàng <small>(không bắt buộc)</small></span><textarea value={address} onChange={event => setAddress(event.target.value)} placeholder="Nhập địa chỉ khách hàng" disabled={!preview}/></label></div>{error && <div className="module-note form-error">{error}</div>}{success && <div className="module-note form-success">{success}</div>}<div className="form-actions"><Link href="/invoices" className="button"><ArrowLeft size={14}/> Quay lại</Link><button className="button primary" type="submit" disabled={!preview || saving}>{saving ? "Đang lập hóa đơn…" : "Lập hóa đơn"}</button></div></form></section>
    </div></section>
  </>;
}

function formatInvoiceMoney(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(Number.isFinite(value) ? value : 0)} ₫`;
}

function InvoicePreviewTable({ preview }: { preview: InvoiceOrderPreview }) {
  return <><div className="invoice-items-table"><table><thead><tr><th>SẢN PHẨM</th><th>SKU</th><th>ĐƠN VỊ</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>GIẢM GIÁ</th><th>THÀNH TIỀN</th></tr></thead><tbody>{preview.lines.map((line, index) => { const discount = Number(line.giam_gia ?? 0) + Number(line.giam_gia_voucher ?? 0); const amount = Number(line.so_luong) * Number(line.don_gia) - discount; return <tr key={`${line.sku}-${index}`}><td>{line.ten_sp_luc_ban ?? "—"}</td><td>{line.sku}</td><td>{line.don_vi_luc_ban ?? "—"}</td><td>{line.so_luong}</td><td>{formatInvoiceMoney(Number(line.don_gia))}</td><td>{formatInvoiceMoney(discount)}</td><td>{formatInvoiceMoney(amount)}</td></tr>; })}</tbody></table></div><div className="invoice-summary"><span>Tổng trước thuế <strong>{formatInvoiceMoney(Number(preview.summary.before_tax))}</strong></span><span>Giảm giá <strong>{formatInvoiceMoney(Number(preview.summary.discount))}</strong></span><span>Tiền thuế <strong>{formatInvoiceMoney(Number(preview.summary.tax))}</strong></span><span className="invoice-total">Tổng thanh toán <strong>{formatInvoiceMoney(Number(preview.summary.total))}</strong></span></div></>;
}
