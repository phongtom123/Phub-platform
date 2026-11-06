"use client";

import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { useEffect, useState } from "react";
import { getInvoiceDetail } from "@/src/lib/warehouse-api";

const money = (value: unknown) => `${Number(value ?? 0).toLocaleString("vi-VN")} ₫`;

export default function InvoiceDetailViewUpdated({ id }: { id: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getInvoiceDetail>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { getInvoiceDetail(id).then(setData).catch(err => setError(err instanceof Error ? err.message : "Không thể tải chi tiết hóa đơn.")); }, [id]);
  if (error) return <div className="not-found"><h1>Không thể tải hóa đơn</h1><p>{error}</p><Link href="/invoices" className="button">Quay lại</Link></div>;
  if (!data) return <div className="auth-loading">Đang tải chi tiết hóa đơn…</div>;
  const invoice = data.invoice;
  return <><div className="page-heading"><div><Link className="back-link" href="/invoices"><ArrowLeft size={14}/> Hóa đơn</Link><h1>Chi tiết {invoice.ma_hoadon}</h1></div><button className="button primary" type="button" onClick={() => window.print()}><FileDown size={14}/> Xuất hóa đơn</button></div><section className="form-panel invoice-print-card"><div className="form-panel-head"><h2>Thông tin hóa đơn</h2><p>Đơn hàng <strong>{invoice.ma_donhang}</strong> · Người lập {invoice.nguoi_lap ?? "—"}</p></div><div className="detail-grid"><div className="detail-field"><span>Người mua</span><strong>{invoice.ten_nguoi_mua ?? "—"}</strong></div><div className="detail-field"><span>Email người mua</span><strong>{invoice.email_nguoi_mua ?? "—"}</strong></div><div className="detail-field"><span>Mã số thuế</span><strong>{invoice.ma_so_thue ?? "—"}</strong></div><div className="detail-field"><span>Địa chỉ</span><strong>{invoice.dia_chi_nguoi_mua ?? "—"}</strong></div></div><div className="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>SKU</th><th>ĐƠN VỊ</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>GIẢM GIÁ</th><th>THÀNH TIỀN</th></tr></thead><tbody>{data.lines.map((line, index) => { const discount = Number(line.giam_gia ?? 0) + Number(line.giam_gia_voucher ?? 0); const amount = Number(line.so_luong) * Number(line.don_gia) - discount; return <tr key={`${line.sku}-${index}`}><td>{line.ten_sp_luc_ban ?? "—"}</td><td>{line.sku}</td><td>{line.don_vi_luc_ban ?? "—"}</td><td>{line.so_luong}</td><td>{money(line.don_gia)}</td><td>{money(discount)}</td><td>{money(amount)}</td></tr>; })}</tbody></table></div><div className="detail-grid"><div className="detail-field"><span>Tổng trước thuế</span><strong>{money(invoice.tong_tien_truoc_thue)}</strong></div><div className="detail-field"><span>Giảm giá</span><strong>{money(invoice.tong_tien_giam)}</strong></div><div className="detail-field"><span>Tiền thuế</span><strong>{money(invoice.tong_tien_thue)}</strong></div><div className="detail-field"><span>Tổng thanh toán</span><strong>{money(invoice.tong_tien_sau_thue)}</strong></div></div></section></>;
}
