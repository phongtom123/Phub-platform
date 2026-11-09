export function normalizeVoucherCode(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase() || null;
  if (!code || code.length > 100 || /[\u0000-\u001f\u007f]/.test(code)) return null;
  return code;
}
