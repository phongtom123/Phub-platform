"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  OperationError,
  operationRead,
  pendingCommand,
  sendCommand,
  type PendingCommand,
} from "./api";
type Settings = {
  store_name: string;
  store_address: string;
  store_phone: string;
  low_stock_threshold: number;
};
export function SettingsForm() {
  const [value, setValue] = useState<Settings | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef<PendingCommand | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void operationRead<Settings>("settings", {}, controller.signal)
      .then(setValue)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    pending.current ??= pendingCommand("settings", "save", null, value);
    try {
      await sendCommand(pending.current);
      pending.current = null;
      setNotice("Đã lưu cấu hình cửa hàng.");
    } catch (e) {
      if (e instanceof OperationError && e.status >= 400 && e.status < 500)
        pending.current = null;
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="live-note" role="status">
          {notice}
        </p>
      )}
      {!value && !error && <p>Đang tải cấu hình…</p>}
      {value && (
        <>
          <fieldset
            disabled={busy || Boolean(pending.current)}
            className="live-form-fields"
          >
            <label>
              Tên cửa hàng *
              <input
                required
                maxLength={200}
                value={value.store_name}
                onChange={(e) =>
                  setValue({ ...value, store_name: e.target.value })
                }
              />
            </label>
            <label>
              Địa chỉ
              <input
                maxLength={500}
                value={value.store_address}
                onChange={(e) =>
                  setValue({ ...value, store_address: e.target.value })
                }
              />
            </label>
            <label>
              Điện thoại
              <input
                maxLength={30}
                value={value.store_phone}
                onChange={(e) =>
                  setValue({ ...value, store_phone: e.target.value })
                }
              />
            </label>
            <label>
              Ngưỡng cảnh báo tồn kho
              <input
                required
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={value.low_stock_threshold}
                onChange={(e) =>
                  setValue({
                    ...value,
                    low_stock_threshold: Number(e.target.value),
                  })
                }
              />
            </label>
          </fieldset>
          <button className="btn primary" disabled={busy}>
            {busy
              ? "Đang lưu…"
              : pending.current
                ? "Thử lại cùng yêu cầu"
                : "Lưu cấu hình"}
          </button>
        </>
      )}
    </form>
  );
}
