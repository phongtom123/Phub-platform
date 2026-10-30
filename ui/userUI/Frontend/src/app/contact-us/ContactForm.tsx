"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { authPageHref } from "@/lib/auth/redirect";
import { AUTH_SESSION_EVENT, getSession, type SessionUser } from "../../../../../shared/auth-client";
import styles from "./contact.module.css";

export type TicketStatus = "MOI" | "DANG_XU_LY" | "DA_GIAI_QUYET" | "DA_DONG";

export type CustomerTicket = {
  ma_phan_hoi: string;
  tieu_de: string;
  noi_dung: string;
  ma_sp: string | null;
  ma_donhang: string | null;
  trang_thai: TicketStatus;
  phan_hoi_quan_ly: string | null;
  ngay_phan_hoi: string | null;
  ngay_tao: string;
  cap_nhat_luc: string;
};

type TicketPage = {
  data: CustomerTicket[];
  total: number;
  page: number;
  page_size: number;
};

type ThreadMessage = {
  id: string;
  content: string;
  author: string;
  created_at: string;
};

type ThreadPage = {
  data: ThreadMessage[];
  total: number;
};

const statusLabels: Record<TicketStatus, string> = {
  MOI: "Mới tiếp nhận",
  DANG_XU_LY: "Đang xử lý",
  DA_GIAI_QUYET: "Đã giải quyết",
  DA_DONG: "Đã đóng",
};

function ticketCode(id: string): string {
  return `PH-${id.slice(0, 8).toUpperCase()}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "Chưa có";
  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "short",
    timeStyle: "short",
  });
}

async function supportRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend/customer/crm/feedback${path}`, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    if (response.status === 403) {
      throw new Error("Chỉ tài khoản khách hàng được gửi và xem yêu cầu hỗ trợ.");
    }
    const detail =
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join("; ")
          : typeof body?.error?.message === "string"
            ? body.error.message
            : "Không thể thực hiện yêu cầu hỗ trợ. Vui lòng thử lại.";
    throw new Error(detail);
  }
  return body as T;
}

function ContactWorkspaceInner({
  initialProductId,
  initialProductName,
  initialOrderId,
  currentPath,
}: {
  initialProductId: string;
  initialProductName: string;
  initialOrderId: string;
  currentPath: string;
}) {
  const loginHref = authPageHref("/auth/login", currentPath, "/");
  const registerHref = authPageHref("/auth/register", currentPath, "/");

  const [sessionVersion, setSessionVersion] = useState(0);
  const [sessionState, setSessionState] = useState<{
    version: number;
    account: SessionUser | null;
    error: string;
  }>({ version: -1, account: null, error: "" });

  const sessionLoading = sessionState.version !== sessionVersion;
  const account = sessionLoading ? null : sessionState.account;
  const sessionError = sessionLoading ? "" : sessionState.error;
  const isCustomer = account?.role === "KHACH_HANG";

  const [subject, setSubject] = useState(() =>
    initialProductId
      ? `Cần tư vấn / hỗ trợ sản phẩm ${initialProductName || initialProductId}`.slice(0, 200)
      : "",
  );
  const [productId, setProductId] = useState(initialProductId);
  const [orderId, setOrderId] = useState(initialOrderId);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const [page, setPage] = useState(1);
  const [ticketsVersion, setTicketsVersion] = useState(0);
  const ticketsKey = `${account?.account_id ?? ""}:${page}:${ticketsVersion}`;
  const [ticketsState, setTicketsState] = useState<{
    key: string;
    data: TicketPage | null;
    error: string;
  }>({ key: "", data: null, error: "" });

  const ticketsLoading = Boolean(isCustomer && ticketsState.key !== ticketsKey);
  const tickets = isCustomer && ticketsState.key === ticketsKey ? ticketsState.data : null;
  const ticketsError = isCustomer && ticketsState.key === ticketsKey ? ticketsState.error : "";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadPage, setThreadPage] = useState(1);
  const [detailVersion, setDetailVersion] = useState(0);
  const detailKey = selectedId ? `${selectedId}:${threadPage}:${detailVersion}` : "";
  const [detailState, setDetailState] = useState<{
    key: string;
    ticket: CustomerTicket | null;
    thread: ThreadPage | null;
    error: string;
  }>({ key: "", ticket: null, thread: null, error: "" });

  const detailLoading = Boolean(isCustomer && selectedId && detailState.key !== detailKey);
  const selectedTicket = isCustomer && selectedId && detailState.key === detailKey ? detailState.ticket : null;
  const thread = isCustomer && selectedId && detailState.key === detailKey ? detailState.thread : null;
  const detailError = isCustomer && selectedId && detailState.key === detailKey ? detailState.error : "";

  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [replyIdempotencyKey, setReplyIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSession(controller.signal)
      .then((user) => {
        if (!controller.signal.aborted) {
          setSessionState({ version: sessionVersion, account: user, error: "" });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setSessionState({
            version: sessionVersion,
            account: null,
            error: err instanceof Error ? err.message : "",
          });
        }
      });
    return () => controller.abort();
  }, [sessionVersion]);

  useEffect(() => {
    const onAuthChange = () => setSessionVersion((v) => v + 1);
    window.addEventListener(AUTH_SESSION_EVENT, onAuthChange);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, onAuthChange);
  }, []);

  useEffect(() => {
    if (!isCustomer) return;
    const controller = new AbortController();
    supportRequest<TicketPage>(`?page=${page}&page_size=10`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setTicketsState({ key: ticketsKey, data: result, error: "" });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setTicketsState({
            key: ticketsKey,
            data: null,
            error: err instanceof Error ? err.message : "Không thể tải danh sách yêu cầu.",
          });
        }
      });
    return () => controller.abort();
  }, [isCustomer, page, ticketsKey]);

  useEffect(() => {
    if (!isCustomer || !selectedId || !detailKey) return;
    const controller = new AbortController();
    Promise.all([
      supportRequest<CustomerTicket>(`/${encodeURIComponent(selectedId)}`, { signal: controller.signal }),
      supportRequest<ThreadPage>(`/${encodeURIComponent(selectedId)}/messages?page=${threadPage}`, {
        signal: controller.signal,
      }).catch(() => null),
    ])
      .then(([detail, messages]) => {
        if (!controller.signal.aborted) {
          setDetailState({ key: detailKey, ticket: detail, thread: messages, error: "" });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setDetailState({
            key: detailKey,
            ticket: null,
            thread: null,
            error: err instanceof Error ? err.message : "Không thể tải chi tiết yêu cầu.",
          });
        }
      });
    return () => controller.abort();
  }, [isCustomer, selectedId, threadPage, detailKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!isCustomer || submitting) return;

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    const trimmedProduct = productId.trim();
    const trimmedOrder = orderId.trim();

    if (!trimmedSubject || !trimmedMessage) {
      setSubmitError("Vui lòng nhập đầy đủ tiêu đề và nội dung cần hỗ trợ.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    try {
      const created = await supportRequest<CustomerTicket>("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tieu_de: trimmedSubject,
          noi_dung: trimmedMessage,
          ...(trimmedProduct ? { ma_sp: trimmedProduct } : {}),
          ...(trimmedOrder ? { ma_donhang: trimmedOrder } : {}),
        }),
      });
      setSubmitSuccess(
        `Đã gửi yêu cầu hỗ trợ thành công! Mã yêu cầu của bạn là ${ticketCode(created.ma_phan_hoi)}.`,
      );
      setMessage("");
      if (!initialProductId) {
        setSubject("");
        setProductId("");
      }
      setOrderId("");
      setPage(1);
      setTicketsVersion((v) => v + 1);
      const nextDetailVersion = detailVersion + 1;
      setSelectedId(created.ma_phan_hoi);
      setThreadPage(1);
      setDetailVersion(nextDetailVersion);
      setDetailState({
        key: `${created.ma_phan_hoi}:1:${nextDetailVersion}`,
        ticket: created,
        thread: { data: [], total: 0 },
        error: "",
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Không thể gửi yêu cầu hỗ trợ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket || replySending) return;
    const text = replyText.trim();
    if (!text) return;

    const key = replyIdempotencyKey ?? crypto.randomUUID();
    if (!replyIdempotencyKey) setReplyIdempotencyKey(key);

    setReplySending(true);
    setReplyError("");
    try {
      await supportRequest(`/${encodeURIComponent(selectedTicket.ma_phan_hoi)}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ text }),
      });
      setReplyText("");
      setReplyIdempotencyKey(null);
      setDetailVersion((v) => v + 1);
      setTicketsVersion((v) => v + 1);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Không thể gửi tin nhắn phản hồi.");
    } finally {
      setReplySending(false);
    }
  }

  if (sessionLoading) {
    return (
      <div className={styles.authNotice} role="status">
        <p>Đang kiểm tra phiên đăng nhập…</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className={styles.authGate} aria-label="Yêu cầu đăng nhập">
        <h2>Đăng nhập để gửi yêu cầu hỗ trợ</h2>
        <p>
          Hệ thống tiếp nhận yêu cầu hỗ trợ và phản hồi trực tiếp theo tài khoản khách hàng.
          {initialProductId && (
            <>
              {" "}
              Bạn đang yêu cầu tư vấn cho sản phẩm{" "}
              <strong>{initialProductName ? `${initialProductName} (${initialProductId})` : initialProductId}</strong>.
            </>
          )}
        </p>
        {sessionError && <p className={styles.inlineNote}>{sessionError}</p>}
        <div className={styles.authActions}>
          <Link href={loginHref} className={styles.primaryLinkBtn}>
            Đăng nhập ngay
          </Link>
          <Link href={registerHref} className={styles.secondaryLinkBtn}>
            Đăng ký tài khoản
          </Link>
        </div>
      </div>
    );
  }

  if (account.role !== "KHACH_HANG") {
    return (
      <div className={styles.authGate} role="alert">
        <h2>Tài khoản không thuộc nhóm khách hàng</h2>
        <p>
          Bạn đang đăng nhập với vai trò <strong>{account.role}</strong> ({account.username}). Chức năng gửi
          yêu cầu hỗ trợ khách hàng chỉ dành cho tài khoản <strong>KHACH_HANG</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.accountBanner}>
        <div>
          <span>Người gửi:</span> <strong>{account.name}</strong> ({account.username})
        </div>
        {initialProductId && (
          <div className={styles.productTag}>
            Sản phẩm đính kèm:{" "}
            <Link href={`/main/product/${encodeURIComponent(initialProductId)}`}>
              {initialProductName ? `${initialProductName} (${initialProductId})` : initialProductId}
            </Link>
          </div>
        )}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          Tiêu đề yêu cầu <em>*</em>
          <input
            name="tieu_de"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Nhập tiêu đề cần tư vấn hoặc hỗ trợ (tối đa 200 ký tự)"
            maxLength={200}
            required
            disabled={submitting}
          />
        </label>

        <div className={styles.twoColumns}>
          <label>
            Mã sản phẩm liên quan (tùy chọn)
            <input
              name="ma_sp"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="Ví dụ: SP001"
              maxLength={100}
              disabled={submitting}
            />
          </label>
          <label>
            Mã đơn hàng liên quan (tùy chọn)
            <input
              name="ma_donhang"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Ví dụ: DH-..."
              maxLength={100}
              disabled={submitting}
            />
          </label>
        </div>

        <label>
          Nội dung chi tiết <em>*</em>
          <textarea
            name="noi_dung"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mô tả chi tiết câu hỏi về cấu hình, tình trạng sản phẩm, bảo hành hoặc đơn hàng của bạn..."
            maxLength={10000}
            required
            disabled={submitting}
          />
        </label>

        <div className={styles.formFooter}>
          <button type="submit" disabled={submitting}>
            {submitting ? "Đang gửi…" : "Gửi liên hệ"}
          </button>
          {submitError && (
            <p className={styles.errorText} role="alert">
              {submitError}
            </p>
          )}
          {submitSuccess && (
            <p className={styles.status} role="status">
              {submitSuccess}
            </p>
          )}
        </div>
      </form>

      <section className={styles.historySection} aria-label="Lịch sử yêu cầu hỗ trợ">
        <div className={styles.historyHeader}>
          <div>
            <h2>Yêu cầu hỗ trợ của bạn</h2>
            <p>Theo dõi tiến độ xử lý và phản hồi từ quản trị viên PHUB.</p>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            disabled={ticketsLoading}
            onClick={() => {
              setTicketsVersion((v) => v + 1);
              if (selectedId) setDetailVersion((v) => v + 1);
            }}
          >
            {ticketsLoading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>

        {ticketsError && (
          <div className={styles.errorBox} role="alert">
            <p>{ticketsError}</p>
            <button type="button" onClick={() => setTicketsVersion((v) => v + 1)}>
              Thử lại
            </button>
          </div>
        )}

        {ticketsLoading && !tickets ? (
          <p className={styles.loadingText} role="status">
            Đang tải danh sách yêu cầu hỗ trợ…
          </p>
        ) : (
          tickets && (
            <div className={styles.ticketSplit}>
              <div className={styles.ticketListColumn}>
                {tickets.data.length === 0 ? (
                  <div className={styles.emptyTickets}>
                    <p>Bạn chưa có yêu cầu hỗ trợ nào.</p>
                  </div>
                ) : (
                  <>
                    <ul className={styles.ticketList}>
                      {tickets.data.map((item) => {
                        const active = selectedId === item.ma_phan_hoi;
                        return (
                          <li key={item.ma_phan_hoi}>
                            <button
                              type="button"
                              className={`${styles.ticketCard} ${active ? styles.ticketCardActive : ""}`}
                              onClick={() => {
                                setSelectedId(item.ma_phan_hoi);
                                setThreadPage(1);
                                setReplyError("");
                              }}
                            >
                              <div className={styles.ticketCardTop}>
                                <strong>{ticketCode(item.ma_phan_hoi)}</strong>
                                <span className={`${styles.badge} ${styles[`status_${item.trang_thai}`]}`}>
                                  {statusLabels[item.trang_thai] ?? item.trang_thai}
                                </span>
                              </div>
                              <div className={styles.ticketSubject}>{item.tieu_de}</div>
                              <div className={styles.ticketMeta}>
                                <span>{formatDateTime(item.ngay_tao)}</span>
                                {item.ma_sp && <span>SP: {item.ma_sp}</span>}
                                {item.ma_donhang && <span>Đơn: {item.ma_donhang}</span>}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {tickets.total > tickets.page_size && (
                      <div className={styles.pagination}>
                        <button
                          type="button"
                          disabled={page <= 1 || ticketsLoading}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          Trước
                        </button>
                        <span>
                          Trang {page} / {Math.ceil(tickets.total / tickets.page_size)} ({tickets.total} yêu cầu)
                        </span>
                        <button
                          type="button"
                          disabled={page * tickets.page_size >= tickets.total || ticketsLoading}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Sau
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={styles.ticketDetailColumn} aria-label="Chi tiết yêu cầu hỗ trợ">
                {!selectedId ? (
                  <div className={styles.emptyDetail}>
                    <p>Chọn một yêu cầu ở danh sách bên trái để xem chi tiết và phản hồi từ quản trị viên.</p>
                  </div>
                ) : detailLoading && !selectedTicket ? (
                  <p className={styles.loadingText} role="status">
                    Đang tải chi tiết yêu cầu…
                  </p>
                ) : detailError ? (
                  <div className={styles.errorBox} role="alert">
                    <p>{detailError}</p>
                    <button type="button" onClick={() => setDetailVersion((v) => v + 1)}>
                      Thử lại
                    </button>
                  </div>
                ) : (
                  selectedTicket && (
                    <div className={styles.detailCard}>
                      <div className={styles.detailHeader}>
                        <div>
                          <span className={styles.detailCode}>{ticketCode(selectedTicket.ma_phan_hoi)}</span>
                          <h3>{selectedTicket.tieu_de}</h3>
                        </div>
                        <span className={`${styles.badge} ${styles[`status_${selectedTicket.trang_thai}`]}`}>
                          {statusLabels[selectedTicket.trang_thai] ?? selectedTicket.trang_thai}
                        </span>
                      </div>

                      <dl className={styles.detailMeta}>
                        <div>
                          <dt>Ngày gửi</dt>
                          <dd>{formatDateTime(selectedTicket.ngay_tao)}</dd>
                        </div>
                        <div>
                          <dt>Cập nhật</dt>
                          <dd>{formatDateTime(selectedTicket.cap_nhat_luc)}</dd>
                        </div>
                        {selectedTicket.ma_sp && (
                          <div>
                            <dt>Sản phẩm</dt>
                            <dd>
                              <Link href={`/main/product/${encodeURIComponent(selectedTicket.ma_sp)}`}>
                                {selectedTicket.ma_sp}
                              </Link>
                            </dd>
                          </div>
                        )}
                        {selectedTicket.ma_donhang && (
                          <div>
                            <dt>Đơn hàng</dt>
                            <dd>{selectedTicket.ma_donhang}</dd>
                          </div>
                        )}
                      </dl>

                      <div className={styles.messageBlock}>
                        <h4>Nội dung đã gửi</h4>
                        <p className={styles.preWrap}>{selectedTicket.noi_dung}</p>
                      </div>

                      <div className={styles.adminReplyBlock}>
                        <h4>Phản hồi từ Quản trị viên</h4>
                        {selectedTicket.phan_hoi_quan_ly ? (
                          <>
                            <p className={styles.preWrap}>{selectedTicket.phan_hoi_quan_ly}</p>
                            {selectedTicket.ngay_phan_hoi && (
                              <small>Phản hồi lúc: {formatDateTime(selectedTicket.ngay_phan_hoi)}</small>
                            )}
                          </>
                        ) : (
                          <p className={styles.mutedText}>
                            Yêu cầu của bạn đang chờ quản trị viên tiếp nhận và phản hồi.
                          </p>
                        )}
                      </div>

                      {thread && thread.data.length > 0 && (
                        <div className={styles.threadSection}>
                          <h4>Lịch sử trao đổi ({thread.total})</h4>
                          <ul className={styles.threadList}>
                            {thread.data.map((msg) => (
                              <li key={msg.id} className={styles.threadItem}>
                                <div className={styles.threadItemHeader}>
                                  <strong>{msg.author}</strong>
                                  <small>{formatDateTime(msg.created_at)}</small>
                                </div>
                                <p className={styles.preWrap}>{msg.content}</p>
                              </li>
                            ))}
                          </ul>
                          {thread.total > 20 && (
                            <div className={styles.pagination}>
                              <button
                                type="button"
                                disabled={threadPage <= 1 || detailLoading}
                                onClick={() => setThreadPage((p) => p - 1)}
                              >
                                Trước
                              </button>
                              <span>Trang {threadPage}</span>
                              <button
                                type="button"
                                disabled={threadPage * 20 >= thread.total || detailLoading}
                                onClick={() => setThreadPage((p) => p + 1)}
                              >
                                Sau
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedTicket.trang_thai !== "DA_DONG" ? (
                        <form className={styles.replyForm} onSubmit={handleSendReply}>
                          <label>
                            Gửi thêm tin nhắn vào yêu cầu này
                            <textarea
                              value={replyText}
                              onChange={(e) => {
                                setReplyText(e.target.value);
                                setReplyIdempotencyKey(null);
                              }}
                              placeholder="Nhập nội dung phản hồi thêm cho quản trị viên..."
                              maxLength={10000}
                              rows={3}
                              required
                              disabled={replySending}
                            />
                          </label>
                          {replyError && (
                            <p className={styles.errorText} role="alert">
                              {replyError}
                            </p>
                          )}
                          <button type="submit" disabled={replySending || !replyText.trim()}>
                            {replySending ? "Đang gửi…" : "Gửi tin nhắn"}
                          </button>
                        </form>
                      ) : (
                        <p className={styles.closedNotice}>
                          Yêu cầu hỗ trợ này đã đóng. Nếu cần hỗ trợ thêm, vui lòng gửi yêu cầu mới ở biểu mẫu bên trên.
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )
        )}
      </section>
    </div>
  );
}

function ContactWorkspace() {
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("product_id")?.trim() ?? "";
  const initialProductName = searchParams.get("product_name")?.trim() ?? "";
  const initialOrderId = searchParams.get("order_id")?.trim() ?? "";
  const currentQuery = searchParams.toString();
  const currentPath = currentQuery ? `/contact-us?${currentQuery}` : "/contact-us";

  return (
    <ContactWorkspaceInner
      key={`${initialProductId}:${initialProductName}:${initialOrderId}`}
      initialProductId={initialProductId}
      initialProductName={initialProductName}
      initialOrderId={initialOrderId}
      currentPath={currentPath}
    />
  );
}

export function ContactForm() {
  return (
    <Suspense
      fallback={
        <div className={styles.authNotice} role="status">
          <p>Đang tải biểu mẫu liên hệ…</p>
        </div>
      }
    >
      <ContactWorkspace />
    </Suspense>
  );
}
