"use client";
import { useEffect, useState } from "react";
import { operationRead } from "./api";
type Thread = {
  data: { id: string; content: string; author: string; created_at: string }[];
  total: number;
};
export function SupportThread({
  ticketId,
  version,
}: {
  ticketId: string;
  version: string;
}) {
  const [result, setResult] = useState<Thread | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void operationRead<Thread>(
      "messages",
      { record_id: ticketId, page: String(page) },
      controller.signal,
    )
      .then(setResult)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [ticketId, version, page]);
  return (
    <section className="support-content">
      <h3>Lịch sử trao đổi</h3>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {result?.data.map((m) => (
        <article key={m.id}>
          <strong>{m.author}</strong>
          <small> · {new Date(m.created_at).toLocaleString("vi-VN")}</small>
          <p style={{ whiteSpace: "pre-wrap" }}>{m.content}</p>
        </article>
      ))}
      {result?.total === 0 && (
        <p>Chưa có tin nhắn được ghi nhận trong lịch sử.</p>
      )}
      {result && result.total > 20 && (
        <div className="live-tools">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Trước
          </button>
          <span>Trang {page}</span>
          <button
            disabled={page * 20 >= result.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </button>
        </div>
      )}
    </section>
  );
}
