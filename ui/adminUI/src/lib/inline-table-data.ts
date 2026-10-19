export type DataRow = Record<string, string | number | null>;
export type DataColumn = { name: string; type: string; required: boolean; generated: boolean; default: string | number | null; immutable: boolean; choices: string[] | null; system?: boolean };
export const inlineStatusLabels: Record<number, string> = { 1: "Hoạt động", 2: "Tạm ngưng", 0: "Đã ẩn" };
export const dataRowKey = (row: DataRow, keys: string[]) => JSON.stringify(keys.map(key => row[key]));
export const editableDataColumns = (columns: DataColumn[], keys: string[]) => columns.filter(column =>
  !keys.includes(column.name) && !column.immutable && !column.generated && !column.system
);

/** Preserve identifiers, send only dirty fields, and keep phone numbers as strings. */
export function inlinePatch(columns: DataColumn[], keys: string[], row: DataRow, draft: Record<string, string>, label: (name: string) => string): DataRow {
  const patch: DataRow = {};
  for (const column of editableDataColumns(columns, keys)) {
    if (!(column.name in draft)) continue;
    if (draft[column.name] === String(row[column.name] ?? "")) continue;
    const text = draft[column.name].trim();
    let value: string | number | null = text || null;
    if (column.required && !text) throw new Error(`${label(column.name)} không được để trống.`);
    if (text && column.type === "int") {
      if (!/^-?\d+$/.test(text) || Number(text) < -2147483648 || Number(text) > 2147483647) throw new Error(`${label(column.name)} phải là số nguyên hợp lệ.`);
      value = Number(text);
    }
    if (column.name === "trang_thai" && ![0, 1, 2].includes(Number(value))) throw new Error("Trạng thái không hợp lệ.");
    if (text.length > (column.type === "text" ? 20000 : 2000)) throw new Error(`${label(column.name)} quá dài.`);
    if (column.choices && value !== null && !column.choices.includes(String(value))) throw new Error(`${label(column.name)} không hợp lệ.`);
    if (value !== (row[column.name] ?? null)) patch[column.name] = value;
  }
  return patch;
}
