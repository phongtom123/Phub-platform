"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { adminFetch } from "../../lib/admin-fetch";
import { dataHref } from "../../lib/data-navigation";
import { useAdminAuth } from "../../components/admin/auth-provider";
import "./operations.css";

type Product = {
  sku: string;
  name: string;
  unit: string | null;
  unit_price: string | number;
  available: number;
};
type Customer = {
  ma_kh: string;
  ten_kh: string;
  sdt: string | null;
  dia_chi_chi_tiet_md: string | null;
  email: string;
};
type DraftLine = { sku: string; quantity: string; unit_price: string; discount: string };
type ManualInvoicePayload = {
  buyer: string;
  email: string;
  tax_id?: string;
  address?: string;
  lines: { sku: string; quantity: number; unit_price: string; discount: string }[];
};
type PendingInvoice = { body: string; key: string };
type CreatedInvoice = { id: string; recordId: string; total: number };
const emptyLine = (): DraftLine => ({ sku: "", quantity: "1", unit_price: "", discount: "0" });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await adminFetch(path, { cache: "no-store", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : "Không xử lý được yêu cầu. Vui lòng thử lại.");
  }
  return body as T;
}

function localAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function ManualInvoiceCreator({ onCreated }: { onCreated: () => void }) {
  const { user } = useAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productQuery, setProductQuery] = useState("");
  const [selectedSku, setSelectedSku] = useState("");
  const [buyer, setBuyer] = useState("");
  const [email, setEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerMessage, setCustomerMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedInvoice | null>(null);
  const pendingCommand = useRef<PendingInvoice | null>(null);
  const storageKey = `phub:manual-invoice:${user?.account_id ?? "staff"}:pending`;

  useEffect(() => {
    const controller = new AbortController();
    void request<{ data: Product[] }>("/api/backend/warehouse/manual-invoices/options", { signal: controller.signal })
      .then(result => {
        if (!controller.signal.aborted) {
          if (!Array.isArray(result.data)) throw new Error("API chưa trả danh sách sản phẩm hợp lệ.");
          setProducts(result.data);
        }
      })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tải được sản phẩm trong kho.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingProducts(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (!saved) return;
      const command = JSON.parse(saved) as PendingInvoice & { payload: ManualInvoicePayload };
      if (typeof command.body !== "string" || !/^[0-9a-f-]{36}$/.test(command.key) ||
        JSON.stringify(command.payload) !== command.body || !Array.isArray(command.payload.lines)) {
        throw new Error("Không khôi phục được yêu cầu lập hóa đơn đang chờ. Hãy kiểm tra hóa đơn trước khi thao tác lại.");
      }
      pendingCommand.current = { body: command.body, key: command.key };
      setPending(true);
      setBuyer(command.payload.buyer);
      setEmail(command.payload.email);
      setTaxId(command.payload.tax_id ?? "");
      setAddress(command.payload.address ?? "");
      setLines(command.payload.lines.map(line => ({
        sku: line.sku, quantity: String(line.quantity), unit_price: line.unit_price, discount: line.discount,
      })));
      setError("Yêu cầu trước chưa xác nhận kết quả. Dùng nút thử lại để kiểm tra, không tạo hóa đơn trùng.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không đọc được yêu cầu lập hóa đơn đang chờ.");
    }
  }, [storageKey]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase("vi");
    return products.filter(product => !query ||
      product.sku.toLocaleLowerCase("vi").includes(query) ||
      product.name.toLocaleLowerCase("vi").includes(query));
  }, [productQuery, products]);

  const totals = useMemo(() => lines.reduce((result, line) => {
    const subtotal = localAmount(line.quantity) * localAmount(line.unit_price);
    const discount = localAmount(line.discount);
    const beforeTax = Math.max(0, subtotal - discount);
    const tax = Math.round(beforeTax * 10) / 100;
    return { subtotal: result.subtotal + subtotal, discount: result.discount + discount, tax: result.tax + tax, total: result.total + beforeTax + tax };
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 }), [lines]);

  function addProduct() {
    const product = products.find(item => item.sku === selectedSku);
    if (!product) return;
    setLines(current => {
      const existing = current.find(line => line.sku === product.sku);
      if (existing) return current.map(line => line.sku === product.sku
        ? { ...line, quantity: String(Math.min(product.available, Number(line.quantity) + 1)) }
        : line);
      return [...current, { sku: product.sku, quantity: "1", unit_price: String(product.unit_price), discount: "0" }];
    });
    setSelectedSku("");
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines(current => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  }

  async function searchCustomers() {
    const query = email.trim();
    setCustomerMessage("");
    setCustomers([]);
    if (query.length < 2) {
      setCustomerMessage("Nhập ít nhất 2 ký tự email để tìm kiếm.");
      return;
    }
    try {
      setSearchingCustomers(true);
      const result = await request<{ customers: Customer[] }>(
        `/api/backend/warehouse/manual-invoices/customers?q=${encodeURIComponent(query)}`,
      );
      if (!Array.isArray(result.customers)) throw new Error("API chưa trả danh sách khách hàng hợp lệ.");
      setCustomers(result.customers);
      setCustomerMessage(result.customers.length ? "" : "Không tìm thấy khách hàng theo email này. Bạn vẫn có thể nhập thông tin thủ công.");
    } catch (reason) {
      setCustomerMessage(reason instanceof Error ? reason.message : "Không tìm được khách hàng.");
    } finally {
      setSearchingCustomers(false);
    }
  }

  function chooseCustomer(customer: Customer) {
    setBuyer(customer.ten_kh);
    setEmail(customer.email);
    setAddress(customer.dia_chi_chi_tiet_md ?? "");
    setCustomers([]);
    setCustomerMessage(`Đã chọn ${customer.ten_kh}${customer.sdt ? ` · ${customer.sdt}` : ""}.`);
  }

  function buildPayload(): ManualInvoicePayload {
    const normalizedEmail = email.trim().toLowerCase();
    if (!buyer.trim()) throw new Error("Nhập tên khách hàng.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Nhập email khách hàng hợp lệ.");
    if (!lines.length) throw new Error("Thêm ít nhất một sản phẩm.");
    return {
      buyer: buyer.trim(),
      email: normalizedEmail,
      ...(taxId.trim() ? { tax_id: taxId.trim() } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      lines: lines.map((line, index) => {
        const quantity = Number(line.quantity);
        const product = products.find(item => item.sku === line.sku);
        const unitPrice = Number(line.unit_price);
        const discount = Number(line.discount);
        if (!product) throw new Error(`Dòng ${index + 1}: sản phẩm không hợp lệ.`);
        if (!/^\d+$/.test(line.quantity) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > product.available) {
          throw new Error(`Dòng ${index + 1}: số lượng phải là số nguyên dương, không vượt tồn khả dụng (${product.available}).`);
        }
        if (!/^\d+(\.\d{1,2})?$/.test(line.unit_price) || !Number.isFinite(unitPrice)) {
          throw new Error(`Dòng ${index + 1}: đơn giá không hợp lệ.`);
        }
        if (!/^\d+(\.\d{1,2})?$/.test(line.discount) || !Number.isFinite(discount) || discount > quantity * unitPrice) {
          throw new Error(`Dòng ${index + 1}: giảm giá không hợp lệ.`);
        }
        return { sku: line.sku, quantity, unit_price: line.unit_price, discount: line.discount };
      }),
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      let body: string;
      if (!pendingCommand.current) {
        const payload = buildPayload();
        body = JSON.stringify(payload);
        const command = { body, key: crypto.randomUUID(), payload };
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(command));
        } catch {
          throw new Error("Không lưu được mã thử lại trong phiên trình duyệt nên chưa gửi hóa đơn. Hãy bật lưu trữ phiên rồi thử lại.");
        }
        pendingCommand.current = { body, key: command.key };
        setPending(true);
      } else {
        body = pendingCommand.current.body;
      }
      setSaving(true);
      const result = await request<{ data: CreatedInvoice[]; replayed: boolean }>("/api/backend/warehouse/manual-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pendingCommand.current.key },
        body,
      });
      if (!Array.isArray(result.data) || result.data.length !== 1 || !result.data[0]?.id || typeof result.replayed !== "boolean") {
        throw new Error("API chưa xác nhận đúng hóa đơn. Giữ nguyên nội dung và thử lại để tránh ghi trùng.");
      }
      setCreated(result.data[0]);
      pendingCommand.current = null;
      setPending(false);
      sessionStorage.removeItem(storageKey);
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lập hóa đơn.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setBuyer("");
    setEmail("");
    setTaxId("");
    setAddress("");
    setLines([]);
    setCreated(null);
    setError("");
  }

  if (created) return <section className="invoice-creator" aria-live="polite">
    <h2>Đã lập hóa đơn {created.id}</h2>
    <p>Hóa đơn đã được ghi nhận và tồn kho đã cập nhật.</p>
    <div className="invoice-creator-actions">
      <Link className="live-primary" href={dataHref("invoices", { key: JSON.stringify([created.id]) })}>Mở hóa đơn</Link>
      <button type="button" onClick={reset}>Lập hóa đơn khác</button>
      <Link href={dataHref("invoices")}>Danh sách hóa đơn</Link>
    </div>
  </section>;

  return <section className="invoice-creator manual-invoice-creator">
    <header className="invoice-creator-heading">
      <span aria-hidden="true">+</span>
      <div><p>Kho · Hóa đơn</p><h2>Lập hóa đơn thủ công</h2></div>
    </header>
    <p className="invoice-creator-note">Lập hóa đơn từ hàng còn khả dụng trong kho đang được phân công. Việc ghi hóa đơn và trừ tồn được thực hiện nguyên tử.</p>
    {error && <p className="invoice-creator-error" role="alert">{error}</p>}
    <form onSubmit={submit}>
      <div className="manual-invoice-fields">
        <label>Tên khách hàng<input required maxLength={200} value={buyer} disabled={saving || pending} onChange={event => setBuyer(event.target.value)} /></label>
        <label>Email khách hàng
          <div className="manual-invoice-email">
            <input required type="email" maxLength={254} autoComplete="email" value={email} disabled={saving || pending}
              onChange={event => { setEmail(event.target.value); setCustomers([]); setCustomerMessage(""); }} />
            <button type="button" disabled={saving || pending || searchingCustomers} onClick={() => void searchCustomers()}>
              {searchingCustomers ? "Đang tìm…" : "Tìm email"}
            </button>
          </div>
        </label>
        <label>Mã số thuế<input maxLength={100} value={taxId} disabled={saving || pending} onChange={event => setTaxId(event.target.value)} /></label>
        <label>Địa chỉ<input maxLength={500} value={address} disabled={saving || pending} onChange={event => setAddress(event.target.value)} /></label>
      </div>
      {customerMessage && <p className="manual-invoice-hint" role="status">{customerMessage}</p>}
      {customers.length > 0 && <div className="manual-invoice-customer-list" role="listbox" aria-label="Khách hàng khớp email">
        {customers.map(customer => <button key={customer.ma_kh} type="button" role="option" onClick={() => chooseCustomer(customer)}>
          <strong>{customer.email}</strong><span>{customer.ten_kh}{customer.sdt ? ` · ${customer.sdt}` : ""}</span>
        </button>)}
      </div>}

      <div className="manual-invoice-product-search">
        <label>Tìm sản phẩm<input value={productQuery} disabled={saving || pending} onChange={event => setProductQuery(event.target.value)} placeholder="Nhập tên hoặc SKU" /></label>
        <label>Sản phẩm còn hàng<select value={selectedSku} disabled={saving || pending || loadingProducts} onChange={event => setSelectedSku(event.target.value)}>
          <option value="">{loadingProducts ? "Đang tải sản phẩm…" : "Chọn sản phẩm"}</option>
          {filteredProducts.map(product => <option key={product.sku} value={product.sku}>
            {product.name} · {product.sku} · Còn {product.available} {product.unit ?? ""}
          </option>)}
        </select></label>
        <button type="button" disabled={!selectedSku || saving || pending} onClick={addProduct}>Thêm sản phẩm</button>
      </div>

      {lines.length > 0 && <div className="invoice-creator-table manual-invoice-lines">
        <table><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Giảm giá</th><th>Thành tiền</th><th /></tr></thead>
          <tbody>{lines.map((line, index) => {
            const product = products.find(item => item.sku === line.sku);
            const amount = Math.max(0, localAmount(line.quantity) * localAmount(line.unit_price) - localAmount(line.discount));
            return <tr key={`${line.sku}:${index}`}>
              <td><strong>{product?.name ?? line.sku}</strong><small>{line.sku} · Còn {product?.available ?? 0}</small></td>
              <td><input aria-label={`Số lượng ${line.sku}`} type="text" inputMode="numeric" pattern="[0-9]*" value={line.quantity} disabled={saving || pending}
                onChange={event => { if (/^\d*$/.test(event.target.value)) updateLine(index, { quantity: event.target.value }); }} /></td>
              <td><input aria-label={`Đơn giá ${line.sku}`} type="text" inputMode="decimal" value={line.unit_price} disabled={saving || pending}
                onChange={event => updateLine(index, { unit_price: event.target.value })} /></td>
              <td><input aria-label={`Giảm giá ${line.sku}`} type="text" inputMode="decimal" value={line.discount} disabled={saving || pending}
                onChange={event => updateLine(index, { discount: event.target.value })} /></td>
              <td>{amount.toLocaleString("vi-VN")} ₫</td>
              <td><button type="button" disabled={saving || pending} onClick={() => setLines(current => current.filter((_, lineIndex) => lineIndex !== index))}>Bỏ</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}

      <dl className="manual-invoice-total">
        <div><dt>Tạm tính</dt><dd>{totals.subtotal.toLocaleString("vi-VN")} ₫</dd></div>
        <div><dt>Giảm giá</dt><dd>{totals.discount.toLocaleString("vi-VN")} ₫</dd></div>
        <div><dt>Thuế 10%</dt><dd>{totals.tax.toLocaleString("vi-VN")} ₫</dd></div>
        <div><dt>Tổng thanh toán</dt><dd>{totals.total.toLocaleString("vi-VN")} ₫</dd></div>
      </dl>
      <div className="invoice-creator-actions">
        <Link href={dataHref("invoices")}>Quay lại</Link>
        <button className="live-primary" type="submit" disabled={saving || loadingProducts || !lines.length}>
          {saving ? "Đang lập…" : pending ? "Thử lại cùng yêu cầu" : "Lập hóa đơn"}
        </button>
      </div>
    </form>
  </section>;
}
