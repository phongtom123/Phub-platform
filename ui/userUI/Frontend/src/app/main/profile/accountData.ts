export const accountNavigation = [
  [
    { id: "dashboard", label: "Account Dashboard" },
    { id: "account", label: "Account Information" },
    { id: "addresses", label: "Address Book" },
    { id: "orders", label: "My Orders" },
  ],
  [
    { id: "downloads", label: "My Downloadable Products" },
    { id: "payments", label: "Stored Payment Methods" },
    { id: "agreements", label: "Billing Agreements" },
    { id: "wishlist", label: "My Wish List" },
  ],
  [
    { id: "reviews", label: "My Product Reviews" },
    { id: "newsletter", label: "Newsletter Subscriptions" },
  ],
] as const;

export type AccountView = typeof accountNavigation[number][number]["id"];
export type EditorKind = "contact" | "newsletter" | "billing" | "shipping";

export interface DemoAccount {
  name: string;
  email: string;
  subscribed: boolean;
  billing: string;
  shipping: string;
}

// Chỉ giữ kiểu dữ liệu và nhãn điều hướng; không có hồ sơ mẫu.


export const emptyAccountViews = {
  orders: "You have placed no orders.",
  downloads: "You have no downloadable products.",
  payments: "You have no stored payment methods.",
  agreements: "You have no billing agreements.",
  wishlist: "You have no items in your wish list.",
  reviews: "You have submitted no product reviews.",
} as const;
