export function cents(value: string): bigint {
  if (!/^[0-9]{1,16}(\.[0-9]{1,2})?$/.test(value))
    throw new Error("Số tiền không hợp lệ.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
}

export function decimal(value: bigint): string {
  if (value < BigInt(0)) throw new Error("Số tiền không hợp lệ.");
  return `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;
}

export function money(value: string, currency = "VND"): string {
  const amount = cents(value);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(amount / BigInt(100))
    .map((part) =>
      part.type === "fraction"
        ? String(amount % BigInt(100)).padStart(2, "0")
        : part.value,
    )
    .join("");
}
