const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function orderDate(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "+07:00");
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "Thời gian không hợp lệ";
}

function cents(value: unknown): bigint | null {
  if (typeof value !== "string") return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  try {
    return BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  } catch {
    return null;
  }
}

/** Add stored decimal money without passing through Number/float. */
export function addOrderMoney(left: unknown, right: unknown) {
  const a = cents(left), b = cents(right);
  if (a === null || b === null) return null;
  const value = a + b;
  return `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
}
