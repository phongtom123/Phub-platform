"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DataRow } from "../../lib/inline-table-data";
import { dataHref } from "../../lib/data-navigation";
import { adminFetch } from "../../lib/admin-fetch";
import { ReferenceInput } from "./reference-input";
import {
  OperationError,
  pendingCommand,
  sendCommand,
  type PendingCommand,
} from "./api";
import "./operations.css";
import { useAdminAuth } from "../../components/admin/auth-provider";
import { ReceiptPricing, ReceiptPricingSummary } from "../pricing/pricing-editor";
import { pricingRequest, confirmationMessage, type PriceInputs, type ReceiptPriceQuote } from "../../../../shared/pricing";

const actions: Record<
  string,
  { action: string; label: string; states: string[] }[]
> = {
  orders: [
    { action: "confirm", label: "Xác nhận đơn", states: ["MOI"] },
    { action: "prepare", label: "Chuẩn bị hàng", states: ["XAC_NHAN"] },
    // Tạm ẩn thao tác xuất kho đơn hàng theo phạm vi hiện tại.
    {
      action: "invoice",
      label: "Lập hóa đơn",
      states: ["XAC_NHAN", "DANG_CHUAN_BI", "DA_XUAT_KHO"],
    },
    { action: "complete", label: "Hoàn thành đơn", states: ["DA_XUAT_KHO"] },
    {
      action: "cancel",
      label: "Hủy đơn",
      states: ["MOI", "XAC_NHAN", "DANG_CHUAN_BI"],
    },
  ],
  receipts: [
    { action: "confirm", label: "Xác nhận nhập kho", states: ["NHAP"] },
    { action: "cancel", label: "Hủy phiếu", states: ["NHAP"] },
  ],
};
type Line = {
  pricing?: PriceInputs;
  sku: string;
  quantity: string;
  warehouse_id: string;
  unit_price: string;
};
const blankLine = (): Line => ({
  sku: "",
  quantity: "1",
  warehouse_id: "2",
  unit_price: "",
});
const ids: Record<string, string> = {
  orders: "ma_donhang",
  receipts: "ma_phieu_nhap",
};

export function OperationPanel({
  resource,
  row,
  create = false,
  onChanged,
  onEditingChange,
}: {
  resource: string;
  row?: DataRow;
  create?: boolean;
  onChanged: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const router = useRouter();
  const { user } = useAdminAuth();
  const [mode, setMode] = useState(create ? "create" : ""),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [warehouse, setWarehouse] = useState("2"),
    [supplier, setSupplier] = useState("");
  const [customer, setCustomer] = useState(""),
    [recipient, setRecipient] = useState(""),
    [phone, setPhone] = useState("");
  const [note, setNote] = useState(""),
    [voucher, setVoucher] = useState(""),
    [employee, setEmployee] = useState("");
  const [amount, setAmount] = useState(""),
    [method, setMethod] = useState("TIEN_MAT"),
    [reference, setReference] = useState("");
  const [quantity, setQuantity] = useState(String(row?.so_luong_ton ?? ""));
  const pending = useRef<PendingCommand | null>(null),
    submitting = useRef(false);
  const status = String(row?.trang_thai ?? ""),
    id = row && ids[resource] ? String(row[ids[resource]]) : null;
  const recordIdentity = resource === "inventory"
    ? JSON.stringify([row?.ma_kho, row?.sku])
    : id ?? "new";
  const storageKey = `phub:pending:${user?.account_id}:${resource}:${recordIdentity}`;
  function remember(command: PendingCommand | null) {
    pending.current = command;
    try {
      if (command) sessionStorage.setItem(storageKey, JSON.stringify(command));
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* In-memory retry remains available when storage is disabled. */
    }
  }
  useEffect(() => {
    pending.current = null;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      const body = saved && JSON.parse(saved.body);
      if (
        saved &&
        saved.resource === resource &&
        body.record_id === id &&
        (resource !== "inventory" ||
          (body.data?.warehouse_id === row?.ma_kho && body.data?.sku === row?.sku)) &&
        /^[0-9a-f-]{36}$/.test(saved.key)
      ) {
        pending.current = saved;
        setError(
          "Có yêu cầu trước chưa xác nhận kết quả. Thử lại cùng yêu cầu để kiểm tra, không tạo thêm bản ghi.",
        );
      }
    } catch {
      /* An invalid local draft does not authorize any backend operation. */
    }
  }, [storageKey, resource, id, row?.ma_kho, row?.sku]);
  useEffect(() => {
    if (!pending.current) setQuantity(String(row?.so_luong_ton ?? ""));
  }, [row?.so_luong_ton]);

  useEffect(() => {
    onEditingChange?.(Boolean(mode || busy || pending.current));
  }, [mode, busy, error, onEditingChange]);
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);
  async function run(
    action: string,
    data: Record<string, unknown> = {},
    expected = status,
  ) {
    if (submitting.current) return;
    const next = {
      action,
      record_id: id,
      expected_status: expected || null,
      data,
    };
    const same = pending.current?.body === JSON.stringify(next);
    if (pending.current && !same) {
      setError(
        "Yêu cầu trước chưa xác định kết quả. Bấm Thử lại để xác nhận trước khi thao tác khác.",
      );
      return;
    }
    if (!pending.current)
      remember(
        pendingCommand(resource, action, id, data, expected || undefined),
      );
    submitting.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const toSend = pending.current;
      if (!toSend) throw new Error("Chưa tạo được yêu cầu. Hãy thử lại.");
      const result = await sendCommand(toSend);
      if (ids[resource] && result.data[0][ids[resource]] === undefined)
        throw new Error("API chưa trả đúng mã bản ghi. Thử lại cùng yêu cầu.");
      remember(null);
      setNotice(
        result.replayed
          ? "Yêu cầu trước đã được ghi nhận; không ghi lặp."
          : "Đã xử lý thành công.",
      );
      if (action === "create") {
        const saved = result.data[0];
        router.push(
          dataHref(resource, { key: JSON.stringify([saved[ids[resource]]]) }),
        );
      } else {
        setMode("");
        onChanged();
      }
    } catch (e) {
      if (
        e instanceof OperationError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 408
      )
        remember(null);
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function retry() {
    if (!pending.current || submitting.current) return;
    const body = JSON.parse(pending.current.body);
    await run(body.action, body.data, body.expected_status ?? "");
  }
  async function editLines() {
    if (!row) return;
    setError("");
    setBusy(true);
    try {
      const child = "receipt-lines";
      const filters = JSON.stringify({ [ids[resource]]: row[ids[resource]] });
      const response = await adminFetch(
        `/api/backend/data/${child}?page_size=100&filters=${encodeURIComponent(filters)}`,
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.detail || "Không tải được dòng hàng.");
      if (
        String(body.filters?.[ids[resource]]) !== String(row[ids[resource]]) ||
        body.data.some(
          (line: DataRow) => line[ids[resource]] !== row[ids[resource]],
        )
      )
        throw new Error(
          "API chưa lọc đúng phiếu. Chưa cho phép sửa dòng hàng.",
        );
      if (body.total > 100)
        throw new Error(
          "Phiếu có hơn 100 dòng. Chưa thể chỉnh sửa bằng biểu mẫu này.",
        );
      // Generic table metadata omits JSON snapshots. Use the pricing API so
      // reopening a draft cannot silently replace its tax list with [].
      const quote = await pricingRequest<ReceiptPriceQuote>(`receipts/${id}`);
      if (quote.status !== "NHAP") throw new Error("Phiếu đã được xử lý. Hãy làm mới.");
      setLines(
        body.data.length
          ? body.data.map((l: DataRow) => {
            const price = quote.lines.find(line => line.sku === l.sku)?.price;
            return ({
              sku: String(l.sku),
              quantity: String(l.so_luong_nhap ?? l.so_luong),
              warehouse_id: "",
              unit_price: String(l.gia_nhap ?? ""),
              pricing: price ? { markup_rate: price.markup_rate, taxes: price.taxes.map(tax => ({ code: tax.code, rate: tax.rate })) } : undefined,
            }); })
          : [blankLine()],
      );
      setMode("lines");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === "assign") {
      void run(mode, { employee_id: employee });
      return;
    }
    if (["payment", "refund"].includes(mode)) {
      if (!window.confirm("Xác nhận tiền đã thực thu/hoàn bên ngoài hệ thống?"))
        return;
      void run(mode, { amount, method, ...(reference ? { reference } : {}) });
      return;
    }
    if (mode === "adjust") {
      void run(mode, {
        warehouse_id: row?.ma_kho,
        sku: row?.sku,
        expected_quantity: row?.so_luong_ton,
        quantity: Number(quantity),
        reason: note,
      });
      return;
    }
    const values = lines.map((l) => ({
      sku: l.sku,
      quantity: Number(l.quantity),
      ...(resource === "orders"
        ? { warehouse_id: Number(l.warehouse_id) }
        : {}),
      unit_price: l.unit_price,
      ...(resource === "receipts" ? l.pricing ?? {} : {}),
    }));
    if (mode === "lines") {
      void run(mode, { lines: values });
      return;
    }
    void run(
      "create",
      resource === "orders"
        ? {
            recipient,
            ...(customer ? { customer_id: customer } : {}),
            ...(phone ? { phone } : {}),
            note,
            ...(voucher ? { voucher_code: voucher } : {}),
            lines: values,
          }
        : {
            warehouse_id: Number(warehouse),
            supplier_id: Number(supplier),
            note,
            lines: values,
          },
    );
  }
  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  if (resource === "transfers" || (!create && !row)) return null;
  return (
    <section className="operation-panel" aria-label="Thao tác nghiệp vụ">
      <div className="live-tools">
        {(actions[resource] ?? [])
          .filter((a) => a.states.includes(status))
          .map((a) => (
            <button
              key={a.action}
              disabled={busy || Boolean(pending.current)}
              onClick={() => {
                if (resource === "receipts" && a.action === "confirm") {
                  setBusy(true); setError("");
                  pricingRequest<ReceiptPriceQuote>(`receipts/${id}`).then(quote => {
                    const approved = window.confirm(confirmationMessage(quote));
                    setBusy(false); if (approved) void run(a.action, { pricing_version: quote.version });
                  }).catch(reason => { setBusy(false); setError(reason.message); });
                } else if (window.confirm(`${a.label}?`)) void run(a.action);
              }}
            >
              {a.label}
            </button>
          ))}
        {resource === "orders" &&
          !["HUY", "HOAN_THANH"].includes(status) &&
          !create && (
            <button
              disabled={busy || Boolean(pending.current)}
              onClick={() => setMode("assign")}
            >
              Phân công phụ trách
            </button>
          )}
        {resource === "orders" && status !== "HUY" && !create && (
          <>
            <button
              disabled={busy || Boolean(pending.current)}
              onClick={() => setMode("payment")}
            >
              Ghi nhận thu tiền
            </button>
            <button
              disabled={busy || Boolean(pending.current)}
              onClick={() => setMode("refund")}
            >
              Ghi nhận hoàn tiền
            </button>
          </>
        )}
        {resource === "receipts" && status === "NHAP" && (
          <button
            disabled={busy || Boolean(pending.current)}
            onClick={() => void editLines()}
          >
            Chỉnh sản phẩm trong phiếu
          </button>
        )}
        {resource === "inventory" && (
          <button
            disabled={busy || Boolean(pending.current)}
            onClick={() => setMode("adjust")}
          >
            Kiểm kê / điều chỉnh
          </button>
        )}
      </div>
      {resource === "receipts" && id && <ReceiptPricingSummary receiptId={Number(id)} status={status} />}
      {error && (
        <p className="live-error" role="alert">
          {error}{" "}
          {pending.current && (
            <button disabled={busy} onClick={() => void retry()}>
              Thử lại cùng yêu cầu
            </button>
          )}
        </p>
      )}
      {notice && (
        <p className="live-note" role="status">
          {notice}
        </p>
      )}
      {mode && (
        <form onSubmit={submit} className="live-form operation-form">
          <h2>
            {mode === "create"
              ? resource === "orders"
                ? "Tạo đơn tại quầy"
                : "Lập phiếu nhập"
              : mode === "lines"
                ? "Sản phẩm trong phiếu nháp"
                : mode === "assign"
                  ? "Phân công xử lý"
                  : mode === "adjust"
                    ? "Kết quả kiểm kê"
                    : mode === "payment"
                      ? "Ghi nhận khoản thu"
                      : "Ghi nhận khoản hoàn"}
          </h2>
          <fieldset
            disabled={busy || Boolean(pending.current)}
            className="live-form-fields"
          >
            {mode === "create" && resource === "orders" && (
              <>
                <label>
                  Khách hàng
                  <ReferenceInput
                    field="ma_kh"
                    value={customer}
                    label="Chọn khách hàng (không bắt buộc)"
                    onChange={(v, r) => {
                      setCustomer(v);
                      if (r) {
                        setRecipient(String(r.ten_kh));
                        setPhone(String(r.sdt ?? ""));
                      }
                    }}
                  />
                </label>
                <label>
                  Tên người mua *
                  <input
                    required
                    maxLength={200}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    value={phone}
                    maxLength={30}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label>
                  Voucher
                  <input
                    value={voucher}
                    disabled={!customer}
                    onChange={(e) => setVoucher(e.target.value)}
                  />
                  <small>Chọn khách hàng để áp dụng giới hạn lượt dùng.</small>
                </label>
              </>
            )}
            {mode === "create" && resource === "receipts" && (
              <>
                <label>
                  Kho nhập cố định
                  <ReferenceInput
                    field="ma_kho"
                    value={warehouse}
                    required
                    label="Chọn kho"
                    disabled
                    searchable={false}
                    onChange={setWarehouse}
                  />
                </label>
                  <label>
                    Nhà cung cấp *
                    <ReferenceInput
                      field="ma_ncc"
                      value={supplier}
                      required
                      label="Chọn nhà cung cấp"
                      onChange={setSupplier}
                    />
                  </label>
              </>
            )}
            {["create", "lines"].includes(mode) && (
              <div className="operation-lines">
                <h3>Sản phẩm</h3>
                {lines.map((l, index) => (
                  <div className="operation-line" key={index}>
                    <label>
                      Sản phẩm *
                      <ReferenceInput
                        field="sku"
                        label={`Chọn sản phẩm dòng ${index + 1}`}
                        required
                        value={l.sku}
                        onChange={(v, r) =>
                          setLine(index, {
                            sku: v,
                            pricing: undefined,
                            ...(resource === "orders" && r
                              ? { unit_price: String(r.gia_ban_hien_tai) }
                              : {}),
                          })
                        }
                      />
                    </label>
                    {resource === "orders" && (
                      <label>
                        Kho xuất cố định
                        <ReferenceInput
                          field="ma_kho"
                          label={`Kho xuất dòng ${index + 1}`}
                          disabled
                          searchable={false}
                          required
                          value={l.warehouse_id}
                          onChange={(v) => setLine(index, { warehouse_id: v })}
                        />
                      </label>
                    )}
                    <label>
                      Số lượng *
                      <input
                        aria-label={`Số lượng dòng ${index + 1}`}
                        required
                        type="number"
                        min={1}
                        max={1000000}
                        step={1}
                        value={l.quantity}
                        onChange={(e) =>
                          setLine(index, { quantity: e.target.value })
                        }
                      />
                    </label>
                    <label>
                        {resource === "orders"
                          ? "Giá bán trước thuế"
                          : "Giá nhập"}{" "}
                        *
                        <input
                          aria-label={`Giá dòng ${index + 1}`}
                          required
                          type="number"
                          min={0}
                          step="0.01"
                          readOnly={resource === "orders"}
                          value={l.unit_price}
                          onChange={(e) =>
                            setLine(index, { unit_price: e.target.value })
                          }
                        />
                    </label>
                    <button
                      type="button"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Bỏ dòng
                    </button>
                    {resource === "receipts" && <ReceiptPricing sku={l.sku} cost={l.unit_price} value={l.pricing} disabled={busy || Boolean(pending.current)} onChange={pricing => setLine(index, { pricing })} />}
                  </div>
                ))}
                <button
                  type="button"
                  disabled={lines.length >= 100}
                  onClick={() =>
                    setLines((current) => [...current, blankLine()])
                  }
                >
                  + Thêm sản phẩm
                </button>
              </div>
            )}
            {mode === "assign" && (
              <label>
                Nhân viên quản trị *
                <ReferenceInput
                  field="ma_nhan_vien"
                  value={employee}
                  required
                  label="Chọn người phụ trách"
                  filters={{ loai_nhan_vien: "ADMIN", trang_thai: "1" }}
                  onChange={setEmployee}
                />
              </label>
            )}
            {["payment", "refund"].includes(mode) && (
              <>
                <p className="live-note operation-wide">
                  Chỉ ghi nhận khoản tiền đã được xác nhận thực tế. Thao tác này
                  không tự chuyển tiền qua ngân hàng hoặc cổng thanh toán.
                </p>
                <label>
                  Số tiền *
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label>
                  Phương thức
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {Object.entries({
                      TIEN_MAT: "Tiền mặt",
                      CHUYEN_KHOAN: "Chuyển khoản",
                      THE: "Thẻ",
                      VI_DIEN_TU: "Ví điện tử",
                    }).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Mã đối soát{method !== "TIEN_MAT" && " *"}
                  <input
                    required={method !== "TIEN_MAT"}
                    maxLength={200}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
              </>
            )}
            {mode === "adjust" && (
              <>
                <p>
                  Tồn trước kiểm kê: {String(row?.so_luong_ton)} · SKU{" "}
                  {String(row?.sku)}
                </p>
                <label>
                  Số lượng thực tế *
                  <input
                    required
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
              </>
            )}
            {["create", "adjust"].includes(mode) && (
              <label className="operation-wide">
                {mode === "adjust" ? "Lý do chênh lệch *" : "Ghi chú"}
                <textarea
                  required={mode === "adjust"}
                  minLength={mode === "adjust" ? 5 : undefined}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            )}
          </fieldset>
          <div className="live-tools">
            <button
              className="live-primary"
              disabled={busy || Boolean(pending.current)}
            >
              {busy ? "Đang xử lý…" : "Xác nhận"}
            </button>
            {!pending.current &&
              !busy &&
              (create ? (
                <Link href={dataHref(resource)}>Hủy</Link>
              ) : (
                <button type="button" onClick={() => setMode("")}>
                  Đóng
                </button>
              ))}
          </div>
        </form>
      )}
    </section>
  );
}
