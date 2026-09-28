// Navigation labels from web2/user/compin.php.
// Destinations will be connected when the corresponding pages are ready.
export const headerCategories = [
  { id: "gaming-pc", label: "PC Gaming", href: "/main/product?category=pc" },
  { id: "desktops", label: "Máy Tính Để Bàn", href: "/main/product?category=pc" },
  { id: "monitors", label: "Màn Hình Gaming", href: "/main/product?category=monitor" },
  { id: "accessories", label: "Phụ Kiện", href: "/main/product?category=accessory" },
  { id: "all", label: "Tất Cả Sản Phẩm", href: "/main/product" },
] as const;

export const guestAccountItems = [
  { label: "Đăng nhập", href: "/auth/login" },
  { label: "Tạo tài khoản mới", href: "/auth/register" },
] as const;
