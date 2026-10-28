"use client";
import { useShopping } from "./ShoppingProvider";
export function AddToCartButton({
  product,
  quantity = 1,
  className,
  label = "Thêm vào giỏ",
}: {
  product: { id: string; sku?: string };
  quantity?: number;
  className?: string;
  label?: string;
}) {
  const shop = useShopping();
  return (
    <button
      type="button"
      className={className}
      disabled={shop.cartLoading || shop.authStatus === "loading"}
      onClick={() => void shop.add(product, quantity)}
    >
      {label}
    </button>
  );
}
