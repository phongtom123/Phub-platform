export interface FooterLink {
  label: string;
  href?: string;
}

// Add href once a destination is implemented. Unconfigured items render as text.
export const footerSections: { title: string; links: FooterLink[] }[] = [
  {
    title: "Thông Tin",
    links: [
      { label: "Về Chúng Tôi" },
      { label: "Chính Sách Bảo Mật" },
      { label: "Tìm Kiếm Sản Phẩm" },
      { label: "Điều Khoản Dịch Vụ" },
      { label: "Giao Hàng & Đổi Trả" },
      { label: "Liên Hệ", href: "#footer-contact" },
    ],
  },
  {
    title: "Linh Kiện PC",
    links: [
      { label: "Vi Xử Lý (CPU)" },
      { label: "Card Đồ Họa (VGA)" },
      { label: "Ổ Cứng (SSD/HDD)" },
      { label: "Bộ Nhớ (RAM)" },
      { label: "Bo Mạch Chủ (Mainboard)" },
      { label: "Nguồn & Tản Nhiệt" },
    ],
  },
  {
    title: "Máy Tính Để Bàn",
    links: [
      { label: "PC Lắp Ráp Tùy Chỉnh" },
      { label: "Máy Chủ (Servers)" },
      { label: "PC All-In-One MSI" },
      { label: "PC Văn Phòng HP" },
      { label: "PC Gaming ASUS" },
    ],
  },
  {
    title: "PC Hiệu Năng Cao",
    links: [
      { label: "PC Gaming" },
      { label: "Máy Trạm (Workstation)" },
      { label: "PC Đồ Họa" },
      { label: "PC Văn Phòng" },
      { label: "Bộ PC Theo Ngân Sách" },
    ],
  },
];

export const paymentMethods = [
  { name: "PayPal", src: "/icons/footer/paypal.png" },
  { name: "Visa", src: "/icons/footer/visa.png" },
  { name: "MasterCard", src: "/icons/footer/mastercard.png" },
  { name: "Discover", src: "/icons/footer/discover.png" },
];
