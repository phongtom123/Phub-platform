export interface FooterLink { label: string; href?: string }
export const footerSections: { title: string; links: FooterLink[] }[] = [
  { title: "Thông tin", links: [{ label: "Về PHUB", href: "/about-us" }, { label: "Liên hệ", href: "/contact-us" }, { label: "Câu hỏi thường gặp", href: "/faq" }] },
  { title: "Mua sắm", links: [{ label: "PC và linh kiện", href: "/main/product" }] },
  { title: "Tài khoản", links: [{ label: "Đăng nhập", href: "/auth/login" }, { label: "Đăng ký", href: "/auth/register" }, { label: "Tài khoản của tôi", href: "/main/profile" }] },
];
export const paymentMethods: { name: string; src: string }[] = [];
export const mobilePaymentMethods: { name: string; src: string; width: number }[] = [];
export const mobilePcParts: FooterLink[] = [{ label: "Danh mục sản phẩm", href: "/main/product" }];
