import Link from "next/link";
import type { CartProduct } from "./cartData";
interface CartItemListProps { items: CartProduct[]; onUpdateQuantity: (id: string, qty: number) => void; onRemoveItem: (id: string) => void }
export function CartItemList(_props: CartItemListProps) {
  return <section><p>Giỏ hàng chưa được kết nối API.</p><Link href="/main/product">Xem sản phẩm</Link></section>;
}
