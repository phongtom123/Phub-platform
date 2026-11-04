"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, FileCheck2, ReceiptText } from "lucide-react";
import { dataHref } from "../../lib/data-navigation";
import { adminFetch } from "../../lib/admin-fetch";
import type { DataRow } from "../../lib/inline-table-data";
import { formatMoney } from "./financial-summary";

type InvoiceLine = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: bigint;
  discount: bigint;
  taxRate: string;
  tax: bigint;
  total: bigint;
};

type InvoicePreview = {
  lines: InvoiceLine[];
  discount: bigint;
  subtotal: bigint;
  tax: bigint;
  total: bigint;
};

type Page = { data: DataRow[]; total: number; order_id: string };
const ZERO = BigInt(0);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);
const FIVE_THOUSAND = BigInt(5_000);
const TEN_THOUSAND = BigInt(10_000);

function unsignedDecimal(value: unknown, scale: number, label: string): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value ?? ""));
  if (!match || (match[2]?.length ?? 0) > scale)
    throw new Error(`${label} không hợp lệ. Hãy tải lại dữ liệu đơn hàng.`);
  return BigInt(match[1]) * TEN ** BigInt(scale) + BigInt((match[2] ?? "").padEnd(scale, "0"));
}

function money(value: unknown, label: string) {
  return unsignedDecimal(value, 2, label);
}

function decimalMoney(value: bigint) {
  return `${value / HUNDRED}.${String(value % HUNDRED).padStart(2, "0")}`;
}

function displayMoney(value: bigint) {
  return formatMoney(decimalMoney(value));
}

export function buildInvoicePreview(rows: DataRow[], orderId: string): InvoicePreview {
  if (!rows.length) throw new Error("Đơn hàng chưa có sản phẩm để lập hóa đơn.");

  const lines = rows.map((row, index): InvoiceLine => {
    if (row.ma_donhang !== orderId)
      throw new Error("API trả về sản phẩm không thuộc đơn hàng đang lập hóa đơn.");

    const quantity = Number(row.so_luong);
    if (!Number.isSafeInteger(quantity) || quantity < 1)
      throw new Error("Số lượng sản phẩm không hợp lệ. Hãy tải lại dữ liệu đơn hàng.");

    const unitPrice = money(row.don_gia, "Đơn giá");
    const lineDiscount = money(row.giam_gia, "Giảm giá dòng");
    const voucherDiscount = money(row.giam_gia_voucher, "Giảm giá voucher");
    const discount = lineDiscount + voucherDiscount;
    const beforeTax = BigInt(quantity) * unitPrice - discount;
    if (beforeTax < ZERO)
      throw new Error("Giảm giá vượt tiền hàng. Chưa thể lập hóa đơn.");

    const rateHundredths = unsignedDecimal(row.thue_suat, 2, "Thuế suất");
    if (rateHundredths > TEN_THOUSAND)
      throw new Error("Thuế suất vượt 100%. Chưa thể lập hóa đơn.");
    // PostgreSQL round() for non-negative numeric values: half rounds up.
    const tax = (beforeTax * rateHundredths + FIVE_THOUSAND) / TEN_THOUSAND;

    return {
      id: String(row.ma_ct_donhang ?? index),
      name: String(row.ten_sp_luc_ban ?? "Sản phẩm"),
      sku: String(row.sku ?? ""),
      quantity,
      unitPrice,
      discount,
      taxRate: `${rateHundredths / HUNDRED},${String(rateHundredths % HUNDRED).padStart(2, "0")}%`,
      tax,
      total: beforeTax + tax,
    };
  });

  return lines.reduce<InvoicePreview>((preview, line) => ({
    lines: preview.lines,
    discount: preview.discount + line.discount,
    subtotal: preview.subtotal + line.total - line.tax,
    tax: preview.tax + line.tax,
    total: preview.total + line.total,
  }), { lines, discount: ZERO, subtotal: ZERO, tax: ZERO, total: ZERO });
}

async function readPage(resource: "order-lines" | "invoices", orderId: string, page: number, signal: AbortSignal): Promise<Page> {
  const params = new URLSearchParams({ order_id: orderId, page: String(page), page_size: "100" });
  const response = await adminFetch(`/api/backend/data/${resource}?${params}`, { cache: "reload", signal });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(typeof body?.detail === "string" ? body.detail : "Không tải được dữ liệu lập hóa đơn.");
  if (!body || body.order_id !== orderId || !Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total < 0 ||
      body.data.some((row: DataRow) => !row || row.ma_donhang !== orderId))
    throw new Error("API chưa trả đúng dữ liệu của đơn hàng. Hãy tải lại.");
  return body as Page;
}

async function readLines(orderId: string, signal: AbortSignal) {
  const first = await readPage("order-lines", orderId, 1, signal);
  if (first.total > 2_000) throw new Error("Đơn hàng có quá nhiều dòng để xem trước hóa đơn.");
  const rows = [...first.data];
  for (let page = 2; rows.length < first.total; page++) {
    const next = await readPage("order-lines", orderId, page, signal);
    if (next.total !== first.total || !next.data.length)
      throw new Error("Sản phẩm trong đơn vừa thay đổi. Hãy tải lại để lập hóa đơn.");
    rows.push(...next.data);
  }
  if (rows.length !== first.total || new Set(rows.map(row => String(row.ma_ct_donhang))).size !== rows.length)
    throw new Error("Chi tiết đơn hàng thiếu hoặc bị trùng. Chưa thể lập hóa đơn.");
  return rows;
}

export function InvoiceCreator({
  orderId,
  buyer,
  address,
  disabled,
  onConfirm,
  onCancel,
}: {
  orderId: string;
  buyer: string;
  address: string;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setPreview(null);
    setExistingId(null);
    setError("");
    void Promise.all([
      readLines(orderId, controller.signal),
      readPage("invoices", orderId, 1, controller.signal),
    ]).then(([rows, invoicePage]) => {
      if (controller.signal.aborted) return;
      if (invoicePage.total > 1 || invoicePage.data.length !== invoicePage.total)
        throw new Error("Không xác định được hóa đơn duy nhất của đơn hàng.");
      const invoice = invoicePage.data[0];
      if (invoice) {
        if (typeof invoice.ma_hoadon !== "string" || !invoice.ma_hoadon)
          throw new Error("Hóa đơn hiện có không hợp lệ. Hãy kiểm tra dữ liệu.");
        setExistingId(invoice.ma_hoadon);
        return;
      }
      setPreview(buildInvoicePreview(rows, orderId));
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Không tạo được bản xem trước hóa đơn.");
    });
    return () => controller.abort();
  }, [orderId, version]);

  return (
    <section className="invoice-creator" aria-labelledby="invoice-creator-title">
      <header className="invoice-creator-heading">
        <span><ReceiptText size={24} aria-hidden="true" /></span>
        <div>
          <p>Trình lập hóa đơn</p>
          <h2 id="invoice-creator-title">Xem trước hóa đơn cho đơn {orderId}</h2>
        </div>
      </header>

      {error && <div className="invoice-creator-error" role="alert">
        <AlertCircle size={20} aria-hidden="true" />
        <div><strong>Chưa thể tải bản xem trước</strong><p>{error}</p></div>
        <button type="button" disabled={disabled} onClick={() => setVersion(value => value + 1)}>Thử lại</button>
      </div>}

      {!error && existingId && <div className="invoice-creator-existing" role="status">
        <FileCheck2 size={24} aria-hidden="true" />
        <div><strong>Đơn hàng đã có hóa đơn {existingId}</strong><p>Không tạo thêm hóa đơn trùng cho cùng một đơn hàng.</p></div>
        <Link href={dataHref("invoices", { orderId })}>Mở hóa đơn</Link>
      </div>}

      {!error && !existingId && !preview && <p role="status">Đang tải sản phẩm và tính bản xem trước…</p>}

      {preview && <>
        <dl className="invoice-creator-buyer">
          <div><dt>Người mua</dt><dd>{buyer || "Chưa ghi nhận"}</dd></div>
          <div><dt>Địa chỉ</dt><dd>{address || "Chưa ghi nhận"}</dd></div>
        </dl>

        <div className="invoice-creator-table">
          <table>
            <thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Giảm giá</th><th>Thuế</th><th>Thành tiền</th></tr></thead>
            <tbody>{preview.lines.map(line => <tr key={line.id}>
              <td><strong>{line.name}</strong><small>SKU: {line.sku}</small></td>
              <td>{line.quantity}</td>
              <td>{displayMoney(line.unitPrice)}</td>
              <td>{displayMoney(line.discount)}</td>
              <td>{displayMoney(line.tax)}<small>{line.taxRate}</small></td>
              <td><strong>{displayMoney(line.total)}</strong></td>
            </tr>)}</tbody>
          </table>
        </div>

        <dl className="invoice-creator-totals">
          <div><dt>Tổng giảm giá</dt><dd>{displayMoney(preview.discount)}</dd></div>
          <div><dt>Tổng trước thuế</dt><dd>{displayMoney(preview.subtotal)}</dd></div>
          <div><dt>Tiền thuế</dt><dd>{displayMoney(preview.tax)}</dd></div>
          <div className="invoice-creator-grand-total"><dt>Tổng thanh toán</dt><dd>{displayMoney(preview.total)}</dd></div>
        </dl>
        <p className="invoice-creator-note">Bản xem trước dùng dữ liệu đã chốt trên đơn. Khi phát hành, backend sẽ tính lại trong transaction và lưu hóa đơn chính thức.</p>
      </>}

      <div className="invoice-creator-actions">
        <button type="button" disabled={disabled} onClick={onCancel}>Đóng</button>
        {preview && <button className="live-primary" type="button" disabled={disabled} onClick={onConfirm}>
          {disabled ? "Đang lập hóa đơn…" : "Xác nhận lập hóa đơn"}
        </button>}
      </div>
    </section>
  );
}
