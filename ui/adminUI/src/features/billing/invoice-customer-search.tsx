"use client";

import { useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/src/lib/admin-fetch";
import { dataHref } from "@/src/lib/data-navigation";

type Customer = { ma_kh: string; ten_kh: string; email?: string | null; sdt?: string | null };
type Order = { ma_donhang: string; ten_nguoi_nhan?: string | null; trang_thai: string };

export function InvoiceCustomerSearch() {
  const [query, setQuery] = useState(""); const [customers, setCustomers] = useState<Customer[]>([]); const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function search() {
    const email = query.trim().toLowerCase(); setError(""); setCustomers([]); setOrders([]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Nhập email khách hàng hợp lệ hoặc tiếp tục nhập thủ công."); return; }
    setLoading(true);
    try { const response = await adminFetch(`/api/backend/warehouse/invoices/customer-search?q=${encodeURIComponent(email)}`); const body = await response.json(); if (!response.ok) throw new Error(body?.detail ?? "Không tìm được khách hàng."); setCustomers(Array.isArray(body.customers) ? body.customers : []); setOrders(Array.isArray(body.orders) ? body.orders : []); if (!body.customers?.length) setError("Không tìm thấy email trong dữ liệu khách hàng. Có thể tiếp tục nhập thủ công."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không tìm được khách hàng."); } finally { setLoading(false); }
  }
  return <section className="live-tools invoice-customer-search" aria-label="Tìm khách hàng bằng email"><div><strong>Tìm khách hàng lập hóa đơn</strong><small>Tra cứu email đã lưu hoặc đăng ký online; thông tin thủ công vẫn được phép nhập.</small></div><div className="live-form-fields"><input type="email" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} placeholder="Nhập email khách hàng…" aria-label="Email khách hàng"/><button type="button" className="live-primary" onClick={() => void search()} disabled={loading}>{loading ? "Đang tìm…" : "Tìm email"}</button></div>{error && <p className="live-error" role="alert">{error}</p>}{customers.map(customer => <div className="invoice-customer-result" key={customer.ma_kh}><strong>{customer.ten_kh}</strong><span>{customer.email ?? query} · {customer.sdt ?? "Không có số điện thoại"}</span></div>)}{orders.length > 0 && <div className="invoice-customer-orders"><strong>Đơn đủ điều kiện lập hóa đơn</strong>{orders.map(order => <Link key={order.ma_donhang} href={dataHref("orders", { key: JSON.stringify([order.ma_donhang]) })}>{order.ma_donhang} · {order.ten_nguoi_nhan ?? "Khách hàng"}</Link>)}</div>}</section>;
}
