export type StoredCartLine = {
  product_id: string;
  sku: string;
  quantity: number;
  selected?: boolean;
};

export function restoreCart(value: unknown): StoredCartLine[] {
  if (!Array.isArray(value) || value.length > 100) return [];
  const seen = new Set<string>();
  return value.filter(
    (item) =>
      item &&
      typeof item.product_id === "string" &&
      item.product_id.length <= 100 &&
      typeof item.sku === "string" &&
      item.sku.length <= 100 &&
      !seen.has(item.sku) &&
      Number.isInteger(item.quantity) &&
      item.quantity >= 1 &&
      item.quantity <= 1000 &&
      (item.selected === undefined || typeof item.selected === "boolean") &&
      (seen.add(item.sku), true),
  );
}

export function mergeStoredCarts(
  accountLines: StoredCartLine[],
  guestLines: StoredCartLine[],
): StoredCartLine[] {
  const merged = new Map(accountLines.map((line) => [line.sku, { ...line }]));
  for (const guestLine of guestLines) {
    const accountLine = merged.get(guestLine.sku);
    if (accountLine) {
      accountLine.quantity = Math.min(
        1000,
        accountLine.quantity + guestLine.quantity,
      );
      accountLine.selected =
        accountLine.selected !== false || guestLine.selected !== false;
    } else if (merged.size < 100) {
      merged.set(guestLine.sku, { ...guestLine });
    }
  }
  return Array.from(merged.values());
}
