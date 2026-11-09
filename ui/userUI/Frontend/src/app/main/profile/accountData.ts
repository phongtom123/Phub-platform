export const accountNavigation = [
  { id: "account", label: "Thông tin cá nhân" },
  { id: "addresses", label: "Địa chỉ giao hàng" },
  { id: "orders", label: "Đơn hàng của tôi" },
] as const;

export const engagementNavigation = [
  { id: 'surveys', label: 'Khảo sát của tôi' },
  { id: 'reviews', label: 'Đánh giá sản phẩm' },
] as const;

export type AccountView = typeof accountNavigation[number]['id'] | typeof engagementNavigation[number]['id'];
