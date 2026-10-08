export interface CartProduct { id: string; name: string; image: string; price: number; quantity: number }
export const cartPage1Data = {
  breadcrumbs: [{ label: "Trang chủ", href: "/" }, { label: "Giỏ hàng", href: "/cart" }],
  title: "Giỏ hàng",
  labels: { price: "Đơn giá", qty: "Số lượng", subtotal: "Tạm tính", updateCart: "Cập nhật giỏ hàng", emptyCart: "Giỏ hàng chưa được kết nối.", continueShopping: "Xem sản phẩm" },
};
