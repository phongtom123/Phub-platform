"use client";

import Link from "next/link";
import { ChevronDown, Eye, MoreHorizontal, Pencil, Search } from "lucide-react";
import type { ColumnDefinition, DataRow } from "@/src/types/admin";

export function Logo({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <b>P</b>
      <strong>PHUB</strong>
      <em>admin</em>
    </>
  );
  return onClick ? (
    <button className="logo logo-home" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="logo">{content}</div>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  const value = String(children);
  const positive = [
    "Hoạt động",
    "Đang bán",
    "Hoàn thành",
    "Đã thanh toán",
    "Đang diễn ra",
    "Còn hàng",
    "Đã nhập",
    "Đã nhận",
    "Thành công",
  ];
  const warning = [
    "Sắp hết",
    "Đang chuẩn bị",
    "Sắp diễn ra",
    "COD",
    "Chờ xử lý",
    "Đang chuyển",
  ];
  const negative = ["Hết hàng", "Tạm khóa", "Tạm ngưng", "Đã hủy", "Thất bại"];
  const info = ["Mới", "Đã xác nhận", "Đã xuất kho"];
  const tone = positive.includes(value)
    ? "green"
    : warning.includes(value)
      ? "yellow"
      : negative.includes(value)
        ? "red"
        : info.includes(value)
          ? "blue"
          : "gray";
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  secondary = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      className={`btn ${secondary ? "secondary" : "primary"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Toolbar({
  query,
  onQueryChange,
  placeholder,
  filters = [],
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  filters?: string[];
}) {
  return (
    <div className="toolbar">
      <label>
        <Search />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={placeholder}
        />
      </label>
      {filters.map((filter) => (
        <button className="filter" key={filter}>
          {filter}
          <ChevronDown />
        </button>
      ))}
    </div>
  );
}

function Cell({
  row,
  column,
  detailSection,
}: {
  row: DataRow;
  column: ColumnDefinition;
  detailSection: string;
}) {
  const value = String(row[column.key] ?? "—");
  const subValue = column.subKey ? String(row[column.subKey] ?? "") : "";
  const rowDetailSection = String(row.detailSection ?? detailSection);
  if (column.kind === "status") return <Badge>{value}</Badge>;
  if (column.kind === "link")
    return (
      <Link
        className="link"
        href={`/${rowDetailSection}/${encodeURIComponent(row.id)}`}
      >
        {value}
      </Link>
    );
  if (column.kind === "stack")
    return (
      <div className="stack">
        <b>{value}</b>
        {subValue && <small>{subValue}</small>}
      </div>
    );
  if (column.kind === "strong") return <b>{value}</b>;
  return <>{value}</>;
}

export function DataTable({
  rows,
  columns,
  detailSection,
}: {
  rows: DataRow[];
  columns: ColumnDefinition[];
  detailSection: string;
}) {
  return (
    <div className="table-card">
      <div className="scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key}>
                    <Cell
                      row={row}
                      column={column}
                      detailSection={detailSection}
                    />
                  </td>
                ))}
                <td>
                  <div className="actions">
                    <Link
                      href={`/${String(row.detailSection ?? detailSection)}/${encodeURIComponent(row.id)}`}
                      title="Xem chi tiết"
                    >
                      <Eye />
                    </Link>
                    <Link
                      href={`/${String(row.detailSection ?? detailSection)}/${encodeURIComponent(row.id)}/edit`}
                      title="Chỉnh sửa trên trang riêng"
                    >
                      <Pencil />
                    </Link>
                    <button title="Thao tác khác">
                      <MoreHorizontal />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer>
        <span>
          Hiển thị 1–{rows.length} trong {rows.length} kết quả
        </span>
        <div>
          <button>‹</button>
          <button className="selected">1</button>
          <button>›</button>
        </div>
      </footer>
    </div>
  );
}

export function Workflow({ items }: { items: string[] }) {
  return (
    <div className="workflow">
      {items.map((item, index) => (
        <div key={item}>
          <span>{index + 1}</span>
          <b>{item}</b>
          {index < items.length - 1 && <span aria-hidden>→</span>}
        </div>
      ))}
    </div>
  );
}

export function SummaryStats({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="inventory-stats">
      {items.map((item) => (
        <article key={item.label}>
          {item.label}
          <b>{item.value}</b>
          <small>Cập nhật theo dữ liệu hiện tại</small>
        </article>
      ))}
    </div>
  );
}
