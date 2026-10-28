export type DataRow = Record<string, string | number | null>;
export type DataColumn = { name: string; type: string; required: boolean; generated: boolean; default: string | number | null; immutable: boolean; choices: string[] | null; system?: boolean };
export const inlineStatusLabels: Record<number, string> = { 1: "Hoạt động", 2: "Tạm ngưng", 0: "Đã ẩn" };
const choiceLabels: Record<string, Record<string, string>> = {
  trang_thai: { NHAP: "Nháp", DA_NHAP: "Đã nhập", HUY: "Đã hủy", DANG_CHUYEN: "Đang chuyển", DA_NHAN: "Đã nhận",
    HOAT_DONG: "Hoạt động", TAM_DUNG: "Tạm dừng", KET_THUC: "Kết thúc", "0": "Đã ẩn", "1": "Hoạt động", "2": "Tạm ngưng" },
  loai_nhan_vien: { ADMIN: "Quản trị viên", NHAN_VIEN_KHO: "Nhân viên kho" },
  loai_giam: { PHAN_TRAM: "Phần trăm", SO_TIEN: "Số tiền" },
};
export function inlineChoiceLabel(field: string, value: DataRow[string]) {
  return value === null || value === undefined ? "—" : choiceLabels[field]?.[String(value)] ?? String(value);
}
export function inlineOptions(column: DataColumn): { value: string | number; label: string }[] {
  return column.name === "trang_thai" && column.type === "int"
    ? [1, 2, 0].map(value => ({ value, label: inlineStatusLabels[value] }))
    : (column.choices ?? []).map(value => ({ value, label: inlineChoiceLabel(column.name, value) }));
}
const dateTimeFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export function inlineDraftValue(column: DataColumn, value: DataRow[string]) {
  if (value === null || value === undefined) return "";
  if (["datetime", "timestamptz"].includes(column.type)) {
    const input = String(value);
    const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(input) ? input : input + "+07:00");
    if (Number.isFinite(date.getTime())) return dateTimeFormatter.format(date).replace(" ", "T");
  }
  return String(value);
}
export const dataRowKey = (row: DataRow, keys: string[]) => JSON.stringify(keys.map(key => row[key]));
export const editableDataColumns = (columns: DataColumn[], keys: string[]) => columns.filter(column =>
  !keys.includes(column.name) && !column.immutable && !column.generated && !column.system
);

/** Preserve identifiers, send only dirty fields, and keep phone numbers as strings. */
export function inlinePatch(columns: DataColumn[], keys: string[], row: DataRow, draft: Record<string, string>, label: (name: string) => string): DataRow {
  const patch: DataRow = {};
  for (const column of editableDataColumns(columns, keys)) {
    if (!(column.name in draft)) continue;
    if (draft[column.name] === inlineDraftValue(column, row[column.name])) continue;
    const text = draft[column.name].trim();
    let value: string | number | null = text || null;
    if (column.required && !text) throw new Error(`${label(column.name)} không được để trống.`);
    if (text && column.type === "int") {
      if (!/^-?\d+$/.test(text) || Number(text) < -2147483648 || Number(text) > 2147483647) throw new Error(`${label(column.name)} phải là số nguyên hợp lệ.`);
      value = Number(text);
    }
    const decimal = /^decimal\((\d+),(\d+)\)$/.exec(column.type);
    if (text && decimal) {
      const amount = /^(\d+)(?:\.(\d+))?$/.exec(text);
      const scale = Number(decimal[2]);
      if (!amount || amount[1].replace(/^0+/, "").length > Number(decimal[1]) - scale || (amount[2]?.length ?? 0) > scale) {
        throw new Error(`${label(column.name)} phải là số không âm, tối đa ${scale} chữ số thập phân.`);
      }
      // Decimal values stay strings: Number would round large product prices.
      value = text;
    }
    if (column.name === "bao_hanh_thang" && typeof value === "number" && value < 0) throw new Error("Bảo hành phải là số tháng không âm.");
    if (column.name === "trang_thai" && column.type === "int" && ![0, 1, 2].includes(Number(value))) throw new Error("Trạng thái không hợp lệ.");
    if (text && ["datetime", "timestamptz"].includes(column.type)) {
      const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : text + "+07:00");
      if (!Number.isFinite(date.getTime())) throw new Error(`${label(column.name)} không phải thời gian hợp lệ.`);
      value = date.toISOString();
    }
    if (text.length > (column.type === "text" ? 20000 : 2000)) throw new Error(`${label(column.name)} quá dài.`);
    if (column.choices && value !== null && !column.choices.includes(String(value))) throw new Error(`${label(column.name)} không hợp lệ.`);
    if (value !== (row[column.name] ?? null)) patch[column.name] = value;
  }
  return patch;
}
