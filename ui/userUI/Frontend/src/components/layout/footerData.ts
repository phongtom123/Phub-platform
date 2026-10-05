export interface FooterLink {
  label: string;
  href?: string;
}

// Add href once a destination is implemented. Unconfigured items render as text.
export const footerSections: { title: string; links: FooterLink[] }[] = [
  {
    title: "Thông Tin",
    links: [
      { label: "Về Chúng Tôi", href: "/about-us" },
      { label: "Chính Sách Bảo Mật" },
      { label: "Tìm Kiếm Sản Phẩm" },
      { label: "Điều Khoản Dịch Vụ", href: "/faq" },
      { label: "Giao Hàng & Đổi Trả" },
      { label: "Liên Hệ", href: "/contact-us" },
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
    title: "Laptop & Tablet",
    links: [
      { label: "Laptop Văn Phòng" },
      { label: "Máy Trạm (Workstation)" },
      { label: "Laptop Gaming Cao Cấp" },
      { label: "Laptop Doanh Nhân" },
      { label: "Máy Tính Bảng (Tablets)" },
    ],
  },
];

export const paymentMethods = [
  { name: "PayPal", src: "/icons/footer/paypal.png" },
  { name: "Visa", src: "/icons/footer/visa.png" },
  { name: "MasterCard", src: "/icons/footer/mastercard.png" },
  { name: "Discover", src: "/icons/footer/discover.png" },
];

export const mobilePaymentMethods = [
  { name: "PayPal", src: "/images/figma-mobile/home-imgPaymentMethodsLightPaypal.svg", width: 34.0712 },
  { name: "Visa", src: "/images/figma-mobile/home-imgPaymentMethodsLightVisa.svg", width: 33.3141 },
  { name: "Maestro", src: "/images/figma-mobile/home-imgPaymentMethodsLightMaestro.svg", width: 33.3141 },
  { name: "Discover", src: "/images/figma-mobile/home-imgPaymentMethodsLightDiscover.svg", width: 34.0712 },
  { name: "American Express", src: "/images/figma-mobile/home-imgPaymentMethodsLightAmericanExpress.svg", width: 33.3141 },
];

export const mobilePcParts: FooterLink[] = [
  { label: "Vi xử lý (CPU)" }, { label: "Card mở rộng" }, { label: "Ổ cứng gắn trong" },
  { label: "Card đồ họa" }, { label: "Bàn phím / Chuột" }, { label: "Vỏ máy / Nguồn / Tản nhiệt" },
  { label: "Bộ nhớ RAM" }, { label: "Phần mềm" }, { label: "Loa / Tai nghe" }, { label: "Bo mạch chủ" },
];
