"use client";

import { useRef, useState, type FormEvent } from "react";
import { staffRequest } from "../../../../shared/invoice-claims";
import styles from "../../../../shared/invoice-claims.module.css";

type Customer = { ma_kh: string; ten_kh: string; sdt: string | null; ten_tai_khoan: string };
type Product = { sku: string; ten_sp: string; unit_price: string; warehouse_id: number; available: number };
type CartLine = Product & { quantity: number };

export default function StaffCounterOrder() {
  const [customerQuery, setCustomerQuery] = useState(""), [productQuery, setProductQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]), [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null), [lines, setLines] = useState<CartLine[]>([]);
  const [recipient, setRecipient] = useState(""), [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false), [searching, setSearching] = useState(false), [error, setError] = useState(""), [created, setCreated] = useState("");
  const pending = useRef<{body: string; key: string} | null>(null), inFlight = useRef(false);
  async function search(kind: "customers" | "products") {
    setSearching(true); setError("");
    try {
      if (kind === "customers") setCustomers((await staffRequest<{data: Customer[]}>(`counter/customers?q=${encodeURIComponent(customerQuery)}`)).data);
      else setProducts((await staffRequest<{data: Product[]}>(`counter/products?q=${encodeURIComponent(productQuery)}`)).data);
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể tra cứu."); }
    finally { setSearching(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current || lines.length === 0) return;
    const body = JSON.stringify({ ...(customer ? {customer_id: customer.ma_kh} : {}), recipient: recipient.trim(), phone: phone.trim() || null,
      lines: lines.map(l => ({ sku: l.sku, warehouse_id: l.warehouse_id, unit_price: l.unit_price, quantity: l.quantity })) });
    if (pending.current?.body !== body) pending.current = { body, key: crypto.randomUUID() };
    inFlight.current = true; setBusy(true); setError("");
    try {
      const result = await staffRequest<{data: {ma_donhang: string}[]}>("counter/orders", {method: "POST",
        headers: {"Content-Type": "application/json", "Idempotency-Key": pending.current.key}, body});
      setCreated(result.data[0].ma_donhang); pending.current = null;
    } catch (err) { setError(err instanceof Error ? err.message : "Chưa xác nhận tạo thành công. Hãy thử lại cùng nội dung."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className={styles.workspace}><h1>Bán tại quầy</h1><p>Chọn đúng tài khoản để khách xem đơn và đánh giá sau khi hoàn thành. Khách chưa có tài khoản có thể yêu cầu liên kết hóa đơn sau.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {created ? <section className={styles.card}><p role="status" className={styles.success}>Đã tạo đơn {created}{customer ? ` cho ${customer.ten_kh} (${customer.ten_tai_khoan})` : " cho khách chưa có tài khoản"}.</p>
      <p>Đơn mới vẫn cần được xử lý, lập hóa đơn, thu tiền, xuất hàng và hoàn thành theo luồng hiện tại.</p>
      <button type="button" onClick={() => { setCreated(""); setLines([]); setCustomer(null); setRecipient(""); setPhone(""); }}>Tạo đơn tiếp theo</button></section> :
      <form onSubmit={submit} className={styles.card}><fieldset className={styles.form} disabled={busy}>
        <div className={styles.columns}><section><h3>Tài khoản khách hàng</h3>
          <label>Tìm tên, mã khách, tài khoản hoặc SĐT<input maxLength={100} value={customerQuery} onChange={e => setCustomerQuery(e.target.value)}/></label>
          <button type="button" disabled={searching} onClick={() => void search("customers")}>Tìm khách</button>
          <label>Chọn khách<select value={customer?.ma_kh ?? ""} onChange={e => { const c = customers.find(x => x.ma_kh === e.target.value) ?? null; setCustomer(c); setRecipient(c?.ten_kh ?? ""); setPhone(c?.sdt ?? ""); }}>
            <option value="">Khách chưa có tài khoản</option>{customers.map(c => <option key={c.ma_kh} value={c.ma_kh}>{c.ten_kh} · {c.ten_tai_khoan} · {c.ma_kh} · {c.sdt || "Chưa có SĐT"}</option>)}</select></label>
          {customer && <p className={styles.hint}>Đơn sẽ thuộc tài khoản <strong>{customer.ten_tai_khoan}</strong>. Xác nhận với khách trước khi tạo.</p>}
        </section><section><h3>Thông tin người mua</h3><label>Tên người mua *<input required maxLength={200} value={recipient} onChange={e => setRecipient(e.target.value)}/></label>
          <label>Số điện thoại<input maxLength={30} value={phone} onChange={e => setPhone(e.target.value)}/></label></section></div>
        <h3>Sản phẩm</h3><label>Tìm theo tên hoặc SKU<input maxLength={100} value={productQuery} onChange={e => setProductQuery(e.target.value)}/></label>
        <button type="button" disabled={searching} onClick={() => void search("products")}>Tìm hàng trong kho</button>
        <label>Thêm sản phẩm<select value="" onChange={e => { const p = products.find(x => `${x.sku}:${x.warehouse_id}` === e.target.value); if (p) setLines(old => old.some(x => x.sku === p.sku && x.warehouse_id === p.warehouse_id) ? old : [...old, {...p, quantity: 1}]); }}>
          <option value="">Chọn sản phẩm và kho xuất</option>{products.map(p => <option key={`${p.sku}:${p.warehouse_id}`} value={`${p.sku}:${p.warehouse_id}`} disabled={p.available < 1}>{p.ten_sp} · {p.sku} · Kho {p.warehouse_id} · Còn {p.available} · {Number(p.unit_price).toLocaleString("vi-VN")} ₫ trước thuế</option>)}</select></label>
        {lines.map((l, index) => <div className={styles.columns} key={`${l.sku}:${l.warehouse_id}`}><div><strong>{l.ten_sp}</strong><p>{l.sku} · Kho {l.warehouse_id} · Giá trước thuế {Number(l.unit_price).toLocaleString("vi-VN")} ₫</p></div>
          <div><label>Số lượng<input type="number" required min={1} max={Math.min(1000000, l.available)} step={1} value={l.quantity} onChange={e => setLines(old => old.map((x, i) => i === index ? {...x, quantity: Number(e.target.value)} : x))}/></label>
            <button type="button" onClick={() => setLines(old => old.filter((_, i) => i !== index))}>Bỏ sản phẩm</button></div></div>)}
        <p>Giá và tồn khả dụng được backend kiểm tra lại khi tạo đơn; không tự ghi nhận đã thanh toán.</p>
        <button type="submit" className={styles.primary} disabled={busy || lines.length === 0}>{busy ? "Đang tạo…" : "Tạo đơn tại quầy"}</button>
      </fieldset></form>}
  </div>;
}
