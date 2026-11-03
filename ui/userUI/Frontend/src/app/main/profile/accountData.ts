export const accountNavigation = [
  { id: "account", label: "Thông tin cá nhân" },
  { id: "addresses", label: "Địa chỉ giao hàng" },
  { id: "orders", label: "Đơn hàng của tôi" },
] as const;

export type AccountView = typeof accountNavigation[number]["id"];
