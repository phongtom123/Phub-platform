"use client";
import { useEffect, useState } from "react";
import { adminFetch } from "../../lib/admin-fetch";
import type { DataRow } from "../../lib/inline-table-data";

export const references: Record<
  string,
  { resource: string; id: string; name: string }
> = {
  ma_kho: { resource: "warehouses", id: "ma_kho", name: "ten_kho" },
  ma_kho_xuat: { resource: "warehouses", id: "ma_kho", name: "ten_kho" },
  ma_kho_nhan: { resource: "warehouses", id: "ma_kho", name: "ten_kho" },
  ma_ncc: { resource: "suppliers", id: "ma_ncc", name: "ten_ncc" },
  ma_loai_sp: { resource: "categories", id: "ma_loai_sp", name: "ten_loai_sp" },
  ma_loai_sp_con: {
    resource: "subcategories",
    id: "ma_loai_sp_con",
    name: "ten_loai_sp_con",
  },
  ma_ctkm: { resource: "promotions", id: "ma_ctkm", name: "ten_chuong_trinh" },
  ma_nhan_vien: { resource: "employees", id: "ma_nhan_vien", name: "ho_ten" },
  ma_kh: { resource: "customers", id: "ma_kh", name: "ten_kh" },
  sku: { resource: "products", id: "sku", name: "ten_sp" },
};

export function ReferenceInput({
  field,
  value,
  onChange,
  required = false,
  disabled = false,
  searchable = true,
  label = "Chọn",
  filters,
}: {
  field: string;
  value: string;
  onChange: (value: string, row?: DataRow) => void;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  label?: string;
  filters?: Record<string, string>;
}) {
  const ref = references[field];
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const [rows, setRows] = useState<DataRow[]>([]),
    [total, setTotal] = useState(0),
    [error, setError] = useState("");
  const filterKey = JSON.stringify(filters ?? {});
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    const params = new URLSearchParams({
      q: searchable ? query : "",
      page: String(page),
      page_size: "50",
      filters: filterKey,
    });
    void adminFetch(`/api/backend/data/${ref.resource}?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (Object.keys(filters ?? {}).length && !body.filters)
          throw new Error("Backend chưa hỗ trợ lọc danh sách chọn.");
        if (!response.ok)
          throw new Error(body.detail || "Không tải được danh sách chọn.");
        if (!controller.signal.aborted) {
          setRows(body.data);
          setTotal(body.total);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(String(e.message));
      });
    return () => controller.abort();
  }, [ref.resource, query, page, filterKey, searchable]);
  return (
    <span className="reference-input">
      {searchable && <input
        aria-label={`Tìm ${label.toLowerCase()}`}
        placeholder="Tìm theo tên hoặc mã…"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
      />}
      <select
        aria-label={label}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value,
            rows.find((row) => String(row[ref.id]) === e.target.value),
          )
        }
      >
        <option value="">{label}</option>
        {value && !rows.some((row) => String(row[ref.id]) === value) && (
          <option value={value}>{value}</option>
        )}
        {rows.map((row) => (
          <option key={String(row[ref.id])} value={String(row[ref.id])}>
            {String(row[ref.name] ?? row[ref.id])} · {String(row[ref.id])}
          </option>
        ))}
      </select>
      {total > 50 && (
        <span className="reference-pages">
          <button
            type="button"
            disabled={disabled || page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </button>
          <small>Trang {page}</small>
          <button
            type="button"
            disabled={disabled || page * 50 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </button>
        </span>
      )}
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
