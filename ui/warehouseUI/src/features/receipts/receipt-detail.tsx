"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cents, displayDate, displayMoney, operationKey, receiptStatus, warehouseApi, WarehouseApiError } from "@/src/lib/warehouse-api";
import { StatusBadge } from "@/src/components/warehouse/ui";
import type { Receipt } from "./types";

export default function ReceiptDetail({ id }: { id: number }) {
  const [record, setRecord] = useState<Receipt | null>(null); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [refresh, setRefresh] = useState(0);
  const [conflict, setConflict] = useState(false); const [message, setMessage] = useState("");
  const pending = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setConflict(false);
    warehouseApi<Receipt>(`warehouse/receipts/${id}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setRecord(data); pending.current = null; } })
      .catch(reason => { if (!controller.signal.aborted) { setRecord(null); setError(reason.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, refresh]);
  async function act(action: "confirm" | "cancel") {
    if (!record || busy || conflict || !window.confirm(action === "confirm" ? "Xác nhận đã nhận đủ hàng? Hệ thống sẽ cộng tồn kho theo các dòng trong phiếu." : "Hủy phiếu nháp này? Tồn kho sẽ giữ nguyên.")) return;
    const body = JSON.stringify({ expected_version: record.version });
    pending.current = operationKey(pending.current, `${action}:${body}`); setBusy(true); setError(""); setMessage("");
    try {
      const saved = await warehouseApi<Receipt>(`warehouse/receipts/${id}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key }, body,
      });
      setRecord(saved); pending.current = null; setMessage(action === "confirm" ? "Đã xác nhận nhập hàng và cập nhật tồn kho." : "Đã hủy phiếu nháp.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không xử lý được phiếu."); setConflict(reason instanceof WarehouseApiError && reason.status === 409); }
    finally { setBusy(false); }
  }
  const total = record?.lines.reduce((sum, line) => sum + cents(line.unit_price) * BigInt(line.quantity), BigInt(0)) ?? BigInt(0);
  return <section className="warehouse-workspace">
    <nav className="warehouse-breadcrumb"><Link href="/">Tổng quan</Link><span>›</span><Link href="/receipts">Phiếu nhập</Link><span>›</span><strong>{record?.receipt.ma_phieu_code ?? id}</strong></nav>
    <div className="warehouse-toolbar"><Link className="button" href="/receipts">← Danh sách phiếu</Link><button className="button" disabled={busy || loading} onClick={() => setRefresh(v => v + 1)}>Làm mới</button>
      {record?.receipt.trang_thai === "NHAP" && !loading && <><Link className={`button${busy ? " disabled" : ""}`} aria-disabled={busy} href={`/receipts/${id}/edit`}>Chỉnh sửa</Link><button className="button primary" disabled={busy || conflict} onClick={() => void act("confirm")}>{busy ? "Đang xử lý…" : "Xác nhận nhập"}</button><button className="button danger" disabled={busy || conflict} onClick={() => void act("cancel")}>Hủy phiếu</button></>}
    </div>
    {loading && <p role="status">Đang tải phiếu…</p>}{error && <p className="warehouse-error" role="alert">{error}</p>}{message && <p className="warehouse-success" role="status">{message}</p>}
    {record && !loading && <>
      <div className="page-heading"><div><h1>Phiếu nhập hàng</h1><p>{record.receipt.ma_phieu_code}</p></div><StatusBadge value={receiptStatus[record.receipt.trang_thai]} /></div>
      <dl className="receiving-card warehouse-details">
        <div><dt>Nhà cung cấp</dt><dd>{record.receipt.supplier_name}</dd></div><div><dt>Kho nhập</dt><dd>Kho #{record.receipt.ma_kho}</dd></div><div><dt>Ngày lập</dt><dd>{displayDate(record.receipt.ngay_tao)}</dd></div><div><dt>Ngày nhập</dt><dd>{displayDate(record.receipt.ngay_nhap)}</dd></div>
        <div><dt>Người lập</dt><dd>{record.receipt.nguoi_tao}</dd></div><div><dt>Người xác nhận</dt><dd>{record.receipt.nguoi_xac_nhan ?? "Chưa xác nhận"}</dd></div><div className="warehouse-wide"><dt>Ghi chú</dt><dd>{record.receipt.ghi_chu || "Không có ghi chú"}</dd></div>
      </dl>
      <div className="receiving-card"><h2>Hàng nhập <span className="warehouse-muted">· {record.lines.length} SKU</span></h2><div className="warehouse-table"><table><thead><tr><th>Sản phẩm / SKU</th><th>Đơn vị</th><th>Số lượng</th><th>Đơn giá nhập</th><th>Thành tiền</th></tr></thead><tbody>
        {record.lines.map(line => <tr key={line.sku}><td><strong>{line.product_name}</strong><small>{line.sku}</small></td><td>{line.unit}</td><td>{line.quantity.toLocaleString("vi-VN")}</td><td>{displayMoney(cents(line.unit_price))}</td><td>{displayMoney(cents(line.unit_price) * BigInt(line.quantity))}</td></tr>)}
      </tbody></table></div><p className="warehouse-total">Tổng giá trị nhập <strong>{displayMoney(total)}</strong></p></div>
      {record.receipt.trang_thai === "DA_NHAP" && <Link className="button" href={`/history?q=${id}`}>Xem lịch sử biến động tồn</Link>}
    </>}
  </section>;
}
