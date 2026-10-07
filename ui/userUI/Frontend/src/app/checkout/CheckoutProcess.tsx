"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import {
  CustomerGate,
  useShopping,
} from "@/components/shopping/ShoppingProvider";
import {
  QuoteTotals,
  useCheckoutQuote,
  VoucherForm,
} from "@/components/shopping/CheckoutSummary";
import { createOrder, saveProfile, ShoppingError } from "@/lib/shopping/client";
import { cents, decimal, money } from "@/lib/shopping/money";
import type { OrderRequest, PaymentMethod, Recipient } from "@/lib/shopping/types";
import { PaymentMethodField } from "@/components/shopping/PaymentMethodField";
import styles from "@/components/shopping/shopping.module.css";

type Attempt = { key: string; body: OrderRequest; owner: string };
const pendingKey = (owner: string) => `phub-checkout-attempt-v1:${owner}`;
function pending(owner: string): Attempt | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(pendingKey(owner)) || "null",
    );
    if (
      !value ||
      value.owner !== owner ||
      !/^([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i.test(
        value.key,
      )
    )
      return null;
    const body = value.body;
    if (
      !body ||
      !Array.isArray(body.items) ||
      !body.items.length ||
      body.items.length > 100 ||
      typeof body.expected_discount !== "string" ||
      typeof body.expected_total !== "string" ||
      !(body.voucher_code === null || typeof body.voucher_code === "string") ||
      !(body.note === null || typeof body.note === "string")
    )
      return null;
    if (
      !["name", "phone", "address_line", "province", "ward"].every(
        (key) => typeof body.recipient?.[key] === "string",
      )
    )
      return null;
    if (
      !body.items.every(
        (line: {
          sku: unknown;
          warehouse_id: unknown;
          quantity: unknown;
          expected_unit_price: unknown;
        }) =>
          typeof line.sku === "string" &&
          Number.isInteger(line.warehouse_id) &&
          Number.isInteger(line.quantity) &&
          Number(line.quantity) > 0 &&
          Number(line.quantity) <= 1000 &&
          typeof line.expected_unit_price === "string",
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
const rolledBack = new Set([
  "PRICE_CHANGED",
  "INSUFFICIENT_STOCK",
  "VOUCHER_NOT_AVAILABLE",
  "VOUCHER_MINIMUM_NOT_MET",
  "VOUCHER_LIMIT_REACHED",
  "CHECKOUT_CHANGED",
  "PRODUCT_NOT_AVAILABLE",
  "WAREHOUSE_NOT_AVAILABLE",
  "AMOUNT_OUT_OF_RANGE",
]);
const notStarted = new Set([
  "AUTH_INTEGRATION_REQUIRED",
  "AUTHENTICATION_REQUIRED",
  "FORBIDDEN",
  "AUTH_CUSTOMER_UNAVAILABLE",
  "CHECKOUT_DATABASE_NOT_READY",
  "ORDER_DATABASE_NOT_READY",
  "ORDER_CONFIGURATION_REQUIRED",
  "VALIDATION_ERROR",
]);

export function CheckoutProcess({ confirmation = false }: { confirmation?: boolean }) {
  const shop = useShopping();
  return (
    <section className={styles.container}>
      <nav>
        <Link href="/cart">Giỏ hàng</Link> › {confirmation ? "Xác nhận đơn hàng" : "Thông tin nhận hàng"}
      </nav>
      <h1>{confirmation ? "Xác nhận đơn hàng" : "Thông tin nhận hàng"}</h1>
      {shop.customer?.demo_mode && <p className={styles.pending}>Chế độ thử nghiệm: đơn hàng và thanh toán là dữ liệu giả lập, không thu tiền thật.</p>}
      <CustomerGate>
        {shop.customer && (
          <Suspense fallback={<p role="status">Đang tải thông tin đặt đơn…</p>}>
            <CheckoutForm key={shop.customer.customer_id} confirmation={confirmation} />
          </Suspense>
        )}
      </CustomerGate>
    </section>
  );
}
function CheckoutForm({ confirmation }: { confirmation: boolean }) {
  const shop = useShopping();
  const customer = shop.customer!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [attempt, setAttempt] = useState<Attempt | null>(() =>
    pending(customer.customer_id),
  );
  const [voucher, setVoucher] = useState<string | null>(
    () =>
      attempt?.body.voucher_code ||
      searchParams.get("voucher"),
  );
  const [recipient, setRecipient] = useState<Recipient>(
    () =>
      attempt?.body.recipient || {
        name: customer.name,
        phone: customer.phone || "",
        address_line: customer.address_line || "",
        province: customer.province || "",
        ward: customer.ward || "",
      },
  );
  const [note, setNote] = useState(attempt?.body.note || "");
  const [phase, setPhase] = useState<
    "editing" | "review" | "submitting" | "uncertain"
  >(attempt ? "uncertain" : confirmation ? "review" : "editing");
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const {
    quote,
    error: quoteError,
    loading,
    reload,
  } = useCheckoutQuote(voucher);
  const locked = phase === "submitting" || phase === "uncertain";
  const hasAddress = [customer.name, customer.phone, customer.address_line, customer.province, customer.ward]
    .every(value => typeof value === "string" && value.trim().length > 0);
  const confirmationUrl = `/checkout/confirm${voucher ? `?voucher=${encodeURIComponent(voucher)}` : ""}`;
  const editingUrl = `/checkout?edit=1${voucher ? `&voucher=${encodeURIComponent(voucher)}` : ""}`;
  const skipForm = !confirmation && hasAddress && searchParams.get("edit") !== "1" && !attempt;
  useEffect(() => {
    if (skipForm) router.replace(confirmationUrl);
    if (confirmation && !hasAddress && !attempt) router.replace(editingUrl);
  }, [skipForm, confirmation, hasAddress, attempt, confirmationUrl, editingUrl, router]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await saveProfile(recipient);
      await shop.refreshSession();
      router.push(confirmationUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu thông tin nhận hàng.");
    } finally {
      setSaving(false);
    }
  }
  async function submit() {
    if (busy.current || shop.cartLoading) return;
    const retrying = attempt !== null;
    if (!attempt && (!quote || shop.cartLoading)) return;
    const sent = attempt || {
      key: crypto.randomUUID(),
      owner: customer.customer_id,
      body: {
        recipient: Object.fromEntries(
          Object.entries(recipient).map(([key, value]) => [key, value.trim()]),
        ) as unknown as Recipient,
        note: note.trim() || null,
        voucher_code: quote!.voucher_code,
        expected_discount: quote!.discount_total,
        expected_total: quote!.total,
        items: quote!.items.map((line) => ({
          sku: line.sku,
          warehouse_id: line.warehouse_id,
          quantity: line.quantity,
          expected_unit_price: line.unit_price,
        })),
      },
    };
    try {
      sessionStorage.setItem(
        pendingKey(customer.customer_id),
        JSON.stringify(sent),
      );
    } catch {
      setError(
        "Không thể lưu lần đặt trên trình duyệt. Hãy bật lưu trữ trước khi gửi đơn.",
      );
      return;
    }
    busy.current = true;
    setAttempt(sent);
    setPhase("submitting");
    setError("");
    try {
      const receipt = await createOrder(sent.body, sent.key);
      try { sessionStorage.setItem(`phub-payment-choice-v1:${sent.owner}:${receipt.id}`, paymentMethod); } catch {}
      try {
        sessionStorage.removeItem(pendingKey(customer.customer_id));
      } catch {}
      shop.completeOrder(sent.body.items, sent.owner);
      setAttempt(null);
      router.replace(`/main/orders/${encodeURIComponent(receipt.id)}`);
    } catch (reason) {
      const known =
        reason instanceof ShoppingError &&
        (rolledBack.has(reason.code) ||
          (!retrying && notStarted.has(reason.code)));
      if (known) {
        try {
          sessionStorage.removeItem(pendingKey(customer.customer_id));
        } catch {}
        setAttempt(null);
        setPhase("review");
        reload();
      } else setPhase("uncertain");
      setError(
        reason instanceof Error
          ? reason.message
          : "Chưa xác nhận được kết quả đặt đơn.",
      );
    } finally {
      busy.current = false;
    }
  }
  if (!shop.selectedLines.length && !attempt && !shop.cartLoading)
    return (
      <p>
        Chưa chọn sản phẩm để thanh toán. <Link href="/cart">Quay lại giỏ hàng</Link>
      </p>
    );
  if (skipForm || (confirmation && !hasAddress && !attempt))
    return <p role="status">Đang mở bước tiếp theo…</p>;
  return (
    <div className={styles.checkoutGrid}>
      <section>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {phase === "uncertain" && (
          <div className={styles.retry} role="status">
            <p>
              Chưa xác nhận được kết quả lần đặt trước. Thử lại sẽ giữ nguyên
              thông tin và mã lần đặt để tránh tạo trùng.
            </p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void submit()}
            >
              Thử lại lần đặt này
            </button>{" "}
            <Link href="/main/profile">Kiểm tra lịch sử đơn</Link>
          </div>
        )}
        {!confirmation && !attempt && <form className={styles.form} onSubmit={save}>
          <h2>Thông tin người nhận</h2>
          {(
            [
              ["name", "Họ tên", 100, "name"],
              ["phone", "Số điện thoại", 30, "tel"],
              ["address_line", "Địa chỉ chi tiết", 255, "street-address"],
              ["province", "Tỉnh / thành phố", 100, "address-level1"],
              ["ward", "Xã / phường", 100, "address-level2"],
            ] as const
          ).map(([key, label, max, autoComplete]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                autoComplete={autoComplete}
                type={key === "phone" ? "tel" : "text"}
                value={recipient[key]}
                required
                maxLength={max}
                disabled={saving}
                onChange={(event) => {
                  setRecipient({ ...recipient, [key]: event.target.value });
                  setPhase("editing");
                }}
              />
            </label>
          ))}
          {!locked && (
            <button
              className={styles.primary}
              type="submit"
              disabled={saving}
            >
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
          )}
        </form>}
        {confirmation && !locked && (
          <section className={styles.panel}>
            <h2>Địa chỉ nhận hàng</h2>
            <p>
              {recipient.name} · {recipient.phone}
            </p>
            <p>
              {recipient.address_line}, {recipient.ward}, {recipient.province}
            </p>
            <Link href={editingUrl}>Sửa thông tin nhận hàng</Link>
            <h2 className={styles.sectionHeading}>Sản phẩm đặt mua</h2>
            <ul>{(quote?.items || shop.selectedLines).map(line => (
              <li key={line.sku}>{line.name} × {line.quantity}</li>
            ))}</ul>
            <section aria-label="Phương thức thanh toán" className={styles.confirmationField}>
              <PaymentMethodField value={paymentMethod} onChange={setPaymentMethod} />
              <p className={styles.muted}>Bạn gửi yêu cầu thanh toán sau khi tạo đơn. Chọn phương thức chưa xác nhận đã trả tiền.</p>
            </section>
            <section aria-label="Hóa đơn" className={styles.confirmationField}>
              <h2>Hóa đơn</h2>
              <div className={styles.tableWrap}><table className={styles.table}>
                <thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền trước thuế</th></tr></thead>
                <tbody>{quote ? quote.items.map(line => <tr key={line.sku}>
                  <td>{line.name}</td><td>{line.quantity}</td><td>{money(line.unit_price, quote.currency)}</td><td>{money(line.line_total, quote.currency)}</td>
                </tr>) : shop.selectedLines.map(line => <tr key={line.sku}>
                  <td>{line.name}</td><td>{line.quantity}</td><td>{line.unavailable ? "" : money(line.unit_price, line.currency)}</td>
                  <td>{line.unavailable ? "" : money(decimal(cents(line.unit_price) * BigInt(line.quantity)), line.currency)}</td>
                </tr>)}</tbody>
              </table></div>
              <p className={styles.muted}>{quote ? "Chi tiết từ báo giá đã kiểm tra; thuế 10% áp khi lập hóa đơn." : "Tạm tính từ giỏ hàng; chưa xác nhận giá bán và tồn kho."} Chưa phải hóa đơn đã lập.</p>
            </section>
            <label className={styles.form}>Ghi chú
              <textarea name="note" value={note} maxLength={1000}
                onChange={event => setNote(event.target.value)} />
            </label>
            <p>
              Đơn sẽ giữ hàng chờ xử lý. Kho trừ tồn thực khi lập phiếu xuất.
            </p>
            <button
              className={styles.primary}
              type="button"
              disabled={shop.cartLoading || !quote}
              onClick={() => void submit()}
            >
              Đặt đơn
            </button>
          </section>
        )}
        {phase === "submitting" && (
          <p role="status">Đang gửi đơn, vui lòng chờ…</p>
        )}
      </section>
      <aside className={styles.panel}>
        <h2>Tóm tắt đơn</h2>
        {confirmation && <VoucherForm
          value={voucher}
          disabled={locked || shop.cartLoading}
          onApply={(code) => {
            setVoucher(code);
            setPhase("review");
          }}
        />}
        {confirmation && loading && !locked && (
          <p role="status">Đang kiểm tra giá và tồn kho…</p>
        )}
        {confirmation && quoteError && !locked && (
          <div className={styles.error} role="alert">
            <p>{quoteError}</p>
            <button type="button" onClick={reload}>
              Kiểm tra lại
            </button>
          </div>
        )}
        {confirmation && quote && !locked && (
          <>
            <QuoteTotals quote={quote} />
          </>
        )}
        {confirmation && !locked && <div className={styles.finalPrice}>
          <span>Giá cuối cùng trước thuế</span>
          <strong aria-label="Giá cuối cùng">{quote ? money(quote.total, quote.currency) : ""}</strong>
        </div>}
        {attempt && locked && (
          <p>
            Tổng tiền trước thuế của lần đặt đang chờ xác nhận:{" "}
            {attempt.body.expected_total}. Thông tin đã được giữ nguyên.
          </p>
        )}
      </aside>
    </div>
  );
}
