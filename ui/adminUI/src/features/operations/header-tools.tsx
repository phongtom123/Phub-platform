"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { dataHref, resourceTitles } from "../../lib/data-navigation";
import { operationRead, pendingCommand, sendCommand } from "./api";
import "./operations.css";
type SearchResult = { resource: string; id: string; title: string };
export function GlobalSearch() {
  const [query, setQuery] = useState(""),
    [result, setResult] = useState<SearchResult[]>([]),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") {
        setQuery("");
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    setResult([]);
    setError("");
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void operationRead<SearchResult[]>(
        "search",
        { q: query.trim() },
        controller.signal,
      )
        .then(setResult)
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return (
    <div
      className={`header-popup-wrap global-search ${mobileOpen ? "is-open" : ""}`}
    >
      <button
        className="mobile-search-trigger"
        type="button"
        aria-label="Mở tìm kiếm"
        aria-expanded={mobileOpen}
        onClick={() => {
          setMobileOpen((value) => !value);
          setTimeout(() => input.current?.focus(), 0);
        }}
      >
        <Search size={18} />
      </button>
      <label>
        <Search />
        <input
          ref={input}
          aria-label="Tìm kiếm toàn hệ thống"
          placeholder="Tìm đơn, khách, sản phẩm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>Ctrl K</kbd>
      </label>
      {query.trim().length >= 2 && (
        <section
          className="global-search-results"
          aria-label="Kết quả tìm kiếm"
        >
          {error ? (
            <p role="alert">{error}</p>
          ) : result.length ? (
            result.map((r) => (
              <Link
                key={`${r.resource}:${r.id}`}
                href={dataHref(r.resource, { key: JSON.stringify([r.id]) })}
                onClick={() => setQuery("")}
              >
                {r.title}
                <small>
                  {resourceTitles[r.resource]} · {r.id}
                </small>
              </Link>
            ))
          ) : (
            <p>Chưa có kết quả phù hợp.</p>
          )}
        </section>
      )}
    </div>
  );
}
type Notification = {
  id: string;
  title: string;
  resource: string;
  key: (string | number)[];
  created_at: string;
  read: boolean;
};
export function NotificationFeed({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [result, setResult] = useState<Notification[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void operationRead<Notification[]>("notifications", {}, controller.signal)
      .then(setResult)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [version]);
  async function follow(n: Notification) {
    setBusy(true);
    setError("");
    try {
      await sendCommand(
        pendingCommand("notifications", "read", null, { ids: [n.id] }),
      );
      router.push(
        n.resource === "support"
          ? `/support?ticket=${n.key[0]}`
          : dataHref(n.resource, { key: JSON.stringify(n.key) }),
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="operations-notifications">
      {error && <p role="alert">{error}</p>}
      {!result && !error && <p>Đang tải thông báo…</p>}
      {result?.length === 0 && <p>Không có thông báo mới.</p>}
      {result?.map((n) => (
        <article key={n.id} data-read={n.read}>
          <button disabled={busy} onClick={() => void follow(n)}>
            {n.title}
          </button>
          <small>
            {n.read ? "Đã đọc" : "Chưa đọc"} ·{" "}
            {new Date(n.created_at).toLocaleString("vi-VN")}
          </small>
        </article>
      ))}
      <button disabled={busy} onClick={() => setVersion((v) => v + 1)}>
        Làm mới
      </button>
    </div>
  );
}
