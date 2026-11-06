/** Completed birthdays, using the Vietnam calendar date. No stored age column. */
export function vietnamDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)?.value).join("-");
}

export function customerAge(birthday: string | null | undefined, today = vietnamDate()): number | null {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
  if (!birthday || !valid(birthday) || !valid(today) || birthday > today) return null;
  const [year, month, day] = birthday.split("-").map(Number), [y, m, d] = today.split("-").map(Number);
  return y - year - (m < month || (m === month && d < day) ? 1 : 0);
}
