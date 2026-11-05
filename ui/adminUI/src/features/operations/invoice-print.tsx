"use client";
import { useEffect, useState } from "react";
import { operationRead } from "./api";
import { adminFetch } from "../../lib/admin-fetch";
import { flushSync } from "react-dom";
import "./operations.css";
export function InvoicePrint({
  orderId,
  ready,
}: {
  orderId: string | null;
  ready: boolean;
}) {
  const [canceled, setCanceled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function print() {
    if (!orderId || busy || !ready) return;
    setBusy(true);
    setError("");
    try {
      const response = await adminFetch(
        `/api/backend/data/orders?key=${encodeURIComponent(JSON.stringify([orderId]))}`,
        { cache: "reload" },
      );
      const body = await response.json();
      if (!response.ok || body.data?.[0]?.ma_donhang !== orderId)
        throw new Error(
          "Chưa xác nhận được trạng thái đơn để in hóa đơn. Hãy thử lại.",
        );
      flushSync(() => setCanceled(body.data[0].trang_thai === "HUY"));
      window.print();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const [store, setStore] = useState<{
    store_name: string;
    store_address: string;
    store_phone: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void operationRead<{
      store_name: string;
      store_address: string;
      store_phone: string;
    }>("settings", {}, controller.signal)
      .then(setStore)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <>
      <div className="live-tools">
        <button
          type="button"
          disabled={busy || !orderId || !ready}
          onClick={() => void print()}
        >
          In / lưu hóa đơn PDF
        </button>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {canceled && (
        <p className="invoice-canceled">
          ĐƠN HÀNG ĐÃ HỦY — Hóa đơn giữ để đối chiếu, không dùng thu tiền.
        </p>
      )}
      {store && (
        <div className="invoice-store">
          <h2>{store.store_name}</h2>
          <p>{store.store_address}</p>
          <p>{store.store_phone}</p>
        </div>
      )}
    </>
  );
}
