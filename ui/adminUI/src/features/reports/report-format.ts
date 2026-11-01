import { formatMoney } from "../operations/financial-summary";

export const reportAmount = (value: string | null) => value === null ? "Chưa đủ dữ liệu" : formatMoney(value);
export const reportPercent = (value: string | null) => value === null ? "Không xác định" : value.replace(".", ",") + "%";
export const reportDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
export const negativeAmount = (value: string | null) => value?.startsWith("-") ?? false;
