"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "../../lib/admin-fetch";
import { dataHref } from "../../lib/data-navigation";
import type { DataColumn, DataRow } from "../../lib/inline-table-data";
import { orderListColumns, orderValue } from "./order-presentation";
import { OrderDetail } from "./order-detail";
import { ScrollableTable } from "../tables/scrollable-table";

type Person = { resource: "customers" | "employees"; id: string };
type Names = Record<string, string | null>;
const personKey = ({ resource, id }: Person) => JSON.stringify([resource, id]);

/** Resolve only people referenced on the current page, using existing protected APIs. */
function useOrderPeople(rows: DataRow[], version: number) {
  const people = new Map<string, Person>();
  for (const row of rows) {
    for (const [field, resource] of [["ma_kh", "customers"], ["ma_nhan_vien", "employees"]] as const) {
      if (typeof row[field] === "string" && row[field]) {
        const person = { resource, id: row[field] };
        people.set(personKey(person), person);
      }
    }
  }
  const identity = JSON.stringify([...people.values()].sort((a, b) => personKey(a).localeCompare(personKey(b))));
  const [names, setNames] = useState<Names>({});
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState("");
  const requestIdentity = JSON.stringify([identity, version, retry]);

  useEffect(() => {
    const controller = new AbortController();
    const queue: Person[] = JSON.parse(identity);
    setNames({}); setSnapshot(requestIdentity);
    // Bound concurrency; repeated customers/employees are fetched only once.
    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        const person = queue.shift()!;
        let name: string | null = null;
        try {
          const key = encodeURIComponent(JSON.stringify([person.id]));
          const response = await adminFetch(`/api/backend/data/${person.resource}?key=${key}`, {
            signal: controller.signal, cache: "no-cache",
          });
          if (!response.ok) throw new Error("Không tải được hồ sơ.");
          const body = await response.json();
          const idField = person.resource === "customers" ? "ma_kh" : "ma_nhan_vien";
          const row = body.data?.find((item: DataRow) => item[idField] === person.id);
          const value = row?.[person.resource === "customers" ? "ten_kh" : "ho_ten"];
          if (typeof value === "string" && value.trim()) name = value.trim();
        } catch { /* Keep the order visible when a related profile cannot be read. */ }
        if (!controller.signal.aborted) setNames(current => ({ ...current, [personKey(person)]: name }));
      }
    };
    void Promise.all(Array.from({ length: Math.min(queue.length, 4) }, worker));
    return () => controller.abort();
  }, [identity, requestIdentity]);

  return { names: snapshot === requestIdentity ? names : {}, retry: () => setRetry(value => value + 1) };
}

type Props = {
  rows: DataRow[]; columns: DataColumn[]; keys: string[]; detail?: boolean; version: number;
  related?: { name: string; title: string }[];
  label: (field: string) => string; href: (row: DataRow) => string;
};

export function OrderData({ rows, columns, keys, detail = false, version, label, href, related = [] }: Props) {
  const { names, retry } = useOrderPeople(rows, version);
  const visibleColumns = detail ? columns : orderListColumns(columns);
  const nameLabel = (field: string) => field === "ma_kh" ? "Khách hàng" : field === "ma_nhan_vien" ? "Nhân viên phụ trách" : label(field);
  const personName = (row: DataRow, field: "ma_kh" | "ma_nhan_vien") => {
    const id = row[field];
    if (!id) return field === "ma_kh" ? String(row.ten_nguoi_nhan || "Khách vãng lai") : "Chưa phân công";
    const resource = field === "ma_kh" ? "customers" : "employees";
    const name = names[personKey({ resource, id: String(id) })];
    if (name === undefined) return <span role="status">Đang tải tên…</span>;
    if (name === null) return "Chưa có thông tin tên";
    return <Link href={dataHref(resource, { key: JSON.stringify([id]) })}>{name}</Link>;
  };
  const cell = (row: DataRow, column: DataColumn) => {
    if (column.name === "ma_kh" || column.name === "ma_nhan_vien") {
      return <>{personName(row, column.name)}{detail && <> · {orderValue(row, column.name)}</>}</>;
    }
    return !detail && keys.includes(column.name) ? <Link href={href(row)}>{orderValue(row, column.name)}</Link> : orderValue(row, column.name);
  };

  return <>
    {Object.values(names).some(name => name === null) && <p className="live-note" role="status">
      Chưa tải được tên của một số hồ sơ. <button type="button" onClick={retry}>Tải lại tên</button>
    </p>}
    {detail ? <OrderDetail row={rows[0]} columns={columns} label={label} personName={personName} related={related} /> : <ScrollableTable><table>
      <thead><tr>{visibleColumns.map(column => <th key={column.name}>{nameLabel(column.name)}</th>)}<th>Thao tác</th></tr></thead>
      <tbody>{rows.map(row => <tr key={JSON.stringify(keys.map(key => row[key]))}>
        {visibleColumns.map(column => <td key={column.name}>{cell(row, column)}</td>)}
        <td><Link href={href(row)}>Chi tiết</Link></td>
      </tr>)}</tbody>
    </table>{!rows.length && <p className="live-note">Chưa có dữ liệu phù hợp.</p>}</ScrollableTable>}
  </>;
}
