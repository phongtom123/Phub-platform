"use client";
import { useState } from "react";
import type { DataColumn } from "../../lib/inline-table-data";
import { inlineChoiceLabel } from "../../lib/inline-table-data";
import { ReferenceInput, references } from "./reference-input";

export function ListFilters({
  columns,
  values,
  onChange,
  label,
  disabled,
}: {
  columns: DataColumn[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  label: (name: string) => string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const set = (key: string, value: string) => {
    const next = { ...values };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  };
  const select = columns.filter(
    (c) =>
      c.name === "trang_thai" ||
      c.name === "kenh_ban" ||
      c.name === "phuong_thuc" ||
      [
        "ma_kho",
        "ma_kho_xuat",
        "ma_kho_nhan",
        "ma_ncc",
        "ma_loai_sp",
        "ma_ctkm",
      ].includes(c.name),
  );
  const day = columns.find((c) =>
    [
      "thoi_gian_dat",
      "thoi_gian_lap",
      "ngay_tao",
      "thoi_gian",
      "ngay_bat_dau",
    ].includes(c.name),
  );
  return (
    <details className="operation-history" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>
        Bộ lọc
        {Object.keys(values).length ? ` (${Object.keys(values).length})` : ""}
      </summary>
      {open && <div className="live-filters">
        {select.map((c) => (
          <label key={c.name}>
            {label(c.name)}
            {references[c.name] ? (
              <ReferenceInput
                field={c.name}
                label={`Tất cả ${label(c.name).toLowerCase()}`}
                value={values[c.name] ?? ""}
                onChange={(value) => set(c.name, value)}
                disabled={disabled}
                searchable={false}
              />
            ) : (
              <select
                aria-label={`Lọc ${label(c.name).toLowerCase()}`}
                disabled={disabled}
                value={values[c.name] ?? ""}
                onChange={(e) => set(c.name, e.target.value)}
              >
                <option value="">Tất cả</option>
                {(
                  c.choices ??
                  (c.name === "trang_thai"
                    ? c.type === "int"
                      ? ["1", "2", "0"]
                      : [
                          "MOI",
                          "XAC_NHAN",
                          "DANG_CHUAN_BI",
                          "DA_XUAT_KHO",
                          "HOAN_THANH",
                          "HUY",
                          "NHAP",
                          "DA_NHAP",
                          "DANG_CHUYEN",
                          "DA_NHAN",
                          "CHO_XU_LY",
                          "THANH_CONG",
                          "THAT_BAI",
                        ]
                    : c.name === "kenh_ban"
                      ? ["ONLINE", "TAI_QUAY"]
                      : ["TIEN_MAT", "CHUYEN_KHOAN", "THE", "VI_DIEN_TU"])
                ).map((v) => (
                  <option key={v} value={v}>
                    {inlineChoiceLabel(
                      c.name,
                      c.type === "int" ? Number(v) : v,
                    )}
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}
        {day && (
          <>
            <label>
              Từ ngày
              <input
                type="date"
                disabled={disabled}
                value={values[`${day.name}__from`] ?? ""}
                onChange={(e) => set(`${day.name}__from`, e.target.value)}
              />
            </label>
            <label>
              Đến ngày
              <input
                type="date"
                disabled={disabled}
                value={values[`${day.name}__to`] ?? ""}
                onChange={(e) => set(`${day.name}__to`, e.target.value)}
              />
            </label>
          </>
        )}
        {Object.keys(values).length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({})}
          >
            Xóa bộ lọc
          </button>
        )}
      </div>}
    </details>
  );
}
