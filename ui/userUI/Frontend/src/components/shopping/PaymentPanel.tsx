"use client";
import { useRef, useState } from "react";
import { requestPayment, shoppingRequest, ShoppingError, validatePayments, validateTransactions } from "@/lib/shopping/client";
import { money } from "@/lib/shopping/money";
import type { PaymentMethod, Transaction } from "@/lib/shopping/types";
import { PaymentMethodField } from "./PaymentMethodField";
import { useShopping } from "./ShoppingProvider";
import { useCustomerResource } from "./useCustomerResource";
import styles from "./shopping.module.css";
const methods = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Thẻ",
  e_wallet: "Ví điện tử",
  unknown: "Chưa xác định",
};
const states = {
  pending: "Đang chờ xử lý",
  succeeded: "Thành công",
  failed: "Thất bại",
  unknown: "Chưa xác định",
};
const types = {
  collection: "Thu tiền",
  refund: "Hoàn tiền",
  unknown: "Chưa xác định",
};
function TransactionInfo({
  transaction,
  currency,
}: {
  transaction: Transaction;
  currency: string;
}) {
  return (
    <div
      className={
        transaction.status === "pending"
          ? styles.pending
          : transaction.status === "succeeded"
            ? styles.success
            : undefined
      }
    >
      <p>
        {types[transaction.type]} · {methods[transaction.method]} ·{" "}
        <strong>{money(transaction.amount, currency)}</strong>
      </p>
      <p>{states[transaction.status]}</p>
      <p>{transaction.message}</p>
      {transaction.occurred_at && (
        <small>{transaction.occurred_at.replace("T", " ")}</small>
      )}
    </div>
  );
}
export function PaymentPanel({ orderId }: { orderId: string }) {
  const shop = useShopping();
  const storageKey = `phub-payment-attempt-v1:${shop.customer?.customer_id}:${orderId}`;
  const [attempt, setAttempt] = useState<{ key: string; method: PaymentMethod } | null>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (value && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.key) &&
          ["cash", "bank_transfer", "card", "e_wallet"].includes(value.method)) return value;
    } catch {}
    return null;
  });
  const [method, setMethod] = useState<PaymentMethod>(() => {
    if (attempt) return attempt.method;
    try {
      const value = sessionStorage.getItem(`phub-payment-choice-v1:${shop.customer?.customer_id}:${orderId}`);
      if (value && ["cash", "bank_transfer", "card", "e_wallet"].includes(value)) return value as PaymentMethod;
    } catch {}
    return "bank_transfer";
  });
  const [requestError, setRequestError] = useState("");
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const [page, setPage] = useState(1);
  const prefix = `orders/${encodeURIComponent(orderId)}`;
  const overview = useCustomerResource(`${prefix}/payments`, validatePayments);
  const history = useCustomerResource(
    `${prefix}/transactions?page=${page}&page_size=10`,
    validateTransactions,
  );
  async function sendRequest() {
    if (busy.current) return;
    const sent = attempt || { key: crypto.randomUUID(), method };
    try { sessionStorage.setItem(storageKey, JSON.stringify(sent)); }
    catch { setRequestError("Không thể lưu lần yêu cầu thanh toán. Hãy bật lưu trữ trước khi tiếp tục."); return; }
    busy.current = true;
    setSending(true);
    setAttempt(sent);
    setRequestError("");
    try {
      await requestPayment(orderId, sent.method, sent.key);
      sessionStorage.removeItem(storageKey);
      setAttempt(null);
      overview.reload(); history.reload();
      window.dispatchEvent(new Event("phub:invoice-changed"));
    } catch (reason) {
      if (reason instanceof ShoppingError && ["PAYMENT_INTEGRATION_REQUIRED", "AUTH_INTEGRATION_REQUIRED", "AUTHENTICATION_REQUIRED", "ACCESS_DENIED", "ORDER_NOT_FOUND", "VALIDATION_ERROR", "PAYMENT_ALREADY_PENDING", "ORDER_ALREADY_PAID", "ORDER_NOT_PAYABLE"].includes(reason.code)) {
        try { sessionStorage.removeItem(storageKey); } catch {}
        setAttempt(null);
        overview.reload(); history.reload();
      }
      setRequestError(reason instanceof Error ? reason.message : "Chưa xác nhận được yêu cầu thanh toán.");
    } finally { busy.current = false; setSending(false); }
  }
  async function simulate(status: string) {
    if (busy.current) return;
    busy.current = true; setSending(true); setRequestError("");
    try {
      await shoppingRequest(`orders/${encodeURIComponent(orderId)}/demo-payment-state`, { method: "POST", body: JSON.stringify({ status }) }, validatePayments);
      overview.reload(); history.reload();
    } catch (reason) { setRequestError(reason instanceof Error ? reason.message : "Không thể đổi trạng thái thử nghiệm."); }
    finally { busy.current = false; setSending(false); }
  }
  return (
    <section id="payments" className={styles.panel}>
      <div className={styles.inline}>
        <h2>Thanh toán</h2>
        <button
          type="button"
          disabled={overview.loading || history.loading}
          onClick={() => {
            overview.reload();
            history.reload();
          }}
        >
          Cập nhật thanh toán
        </button>
      </div>
      <div className={styles.panel}>
        <PaymentMethodField value={method} onChange={setMethod} disabled={sending || !!attempt || overview.data?.latest_transaction?.status === "pending"} />
        {attempt && !sending && <p className={styles.pending}>Yêu cầu trước chưa xác nhận kết quả. Thử lại giữ nguyên phương thức và lần yêu cầu để tránh gửi trùng.</p>}
        <button type="button" className={styles.primary} disabled={sending || (!attempt && (overview.loading || overview.data?.latest_transaction?.status === "pending"))}
          onClick={() => void sendRequest()}>
          {sending ? "Đang xử lý…" : attempt ? "Thử lại yêu cầu thanh toán" : "Yêu cầu thanh toán"}
        </button>
        <p className={styles.muted}>Yêu cầu đang chờ chưa xác nhận đã trả tiền. Trạng thái được cập nhật sau khi khoản thanh toán được xác minh.</p>
        {requestError && <p role="alert" className={styles.error}>{requestError}</p>}
      </div>
      {shop.customer?.demo_mode && <section className={styles.panel} aria-label="Mô phỏng thanh toán">
        <h3>Mô phỏng thanh toán — không thu tiền thật</h3>
        <div className={styles.inline}>{[
          ["pending", "Đang chờ"], ["succeeded", "Thành công"], ["failed", "Thất bại"], ["refund", "Hoàn tiền"],
        ].map(([status, label]) => <button key={status} type="button" disabled={sending || !overview.data?.latest_transaction} onClick={() => void simulate(status)}>Mô phỏng {label}</button>)}</div>
      </section>}
      {overview.loading && <p role="status">Đang tải trạng thái thanh toán…</p>}
      {overview.error && (
        <p className={styles.error} role="alert">
          {overview.error}
        </p>
      )}
      {overview.data && (
        <>
          <p>{overview.data.message}</p>
          {overview.data.latest_transaction ? (
            <TransactionInfo
              transaction={overview.data.latest_transaction}
              currency={overview.data.currency}
            />
          ) : (
            <p className={styles.pending}>
              Chưa có giao dịch. Đơn đang chờ ghi nhận thanh toán.
            </p>
          )}
        </>
      )}
      <p className={styles.muted}>
        Trạng thái trên là của giao dịch mới nhất. Một giao dịch thu hoặc hoàn
        tiền không xác nhận toàn bộ đơn đã được tất toán.
      </p>
      <h3>Lịch sử giao dịch</h3>
      {history.loading && <p role="status">Đang tải lịch sử…</p>}
      {history.error && (
        <p className={styles.error} role="alert">
          {history.error}
        </p>
      )}
      {history.data && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Phương thức</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {history.data.items.map((transaction, index) => (
                  <tr key={index}>
                    <td>{types[transaction.type]}</td>
                    <td>{methods[transaction.method]}</td>
                    <td>{money(transaction.amount, history.data!.currency)}</td>
                    <td>
                      {states[transaction.status]}
                      <p>{transaction.message}</p>
                    </td>
                    <td>
                      {transaction.occurred_at?.replace("T", " ") ||
                        "Chưa ghi nhận"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!history.data.items.length && (
            <p>Chưa có giao dịch trong trang này.</p>
          )}
          <div className={styles.pager}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Trang trước
            </button>
            <span>
              Trang {page} / {Math.max(1, history.data.pagination.total_pages)}
            </span>
            <button
              type="button"
              disabled={page >= history.data.pagination.total_pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}
