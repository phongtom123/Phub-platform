export const productPage1Tabs = [
  { id: "about", label: "Về sản phẩm" },
  { id: "details", label: "Chi tiết" },
  { id: "specs", label: "Thông số" },
] as const;

export const productPage1Colors = [
  { id: "dark", label: "Xám đậm", color: "#4f5663" },
  { id: "cream", label: "Kem", color: "#f1e8d8" },
  { id: "silver", label: "Bạc", color: "#e7e7e9" },
] as const;

export const tridentDesignContent = {
  productId: "trident-pc",
  summary: "MSI MPG Trident 3 10SC-005AU: Intel i7 10700F, GeForce RTX 2060 SUPER, RAM 16GB, SSD 512GB, HDD 2TB, Windows 10 Home, kèm bàn phím và chuột gaming. Bảo hành 3 năm.",
  image: "/images/figma-mobile/product-page-1/product-trident.png",
};

export const competitionContent = {
  title: "Vượt lên mọi giới hạn",
  description: "Hiệu năng tăng 40% so với thế hệ trước. Máy tính để bàn MSI trang bị bộ xử lý Intel® Core™ i7 thế hệ 10, mang đến sức mạnh tối ưu cho trải nghiệm chơi game ấn tượng.",
  note: "*So sánh hiệu năng với i7-9700. Thông số có thể thay đổi theo từng mẫu.",
  image: "/images/figma-mobile/product-page-1/intel-chip.png",
};

export const supportLinks = [
  { label: "Hỗ trợ sản phẩm", href: "/contact-us" },
  { label: "Câu hỏi thường gặp", href: "/faq" },
  { label: "Hướng dẫn mua hàng" },
] as const;

export const productFeaturesIntro = "Dòng MPG phát huy tối đa sức mạnh của game thủ với khả năng thể hiện màu sắc đầy đủ và đồng bộ hệ thống đèn RGB tiên tiến.";

export const productFeatures = [
  {
    id: "intel",
    image: "/images/figma-mobile/product-page-1/feature-intel.png",
    lead: "Bộ xử lý Intel® Core™ i7",
    body: "mang đến sức mạnh vượt trội để bạn tận hưởng trải nghiệm chơi game ấn tượng.",
  },
  {
    id: "rtx",
    image: "/images/figma-mobile/product-page-1/feature-rtx.png",
    lead: "Dòng GeForce® RTX SUPER™",
    body: "có nhiều nhân và xung nhịp cao hơn, cho hiệu năng vượt trội so với GPU thế hệ trước.",
  },
  {
    id: "ssd",
    image: "/images/figma-mobile/product-page-1/feature-ssd.png",
    lead: "Công nghệ SSD NVMe mới nhất",
    body: "khai thác tối đa hiệu năng lưu trữ, nhanh gấp 6 lần SSD SATA truyền thống.",
  },
  {
    id: "ddr4",
    image: "/images/figma-mobile/product-page-1/feature-ddr4.png",
    lead: "Bộ xử lý Intel® Core™ thế hệ 10",
    body: "hỗ trợ bộ nhớ DDR4 2933MHz, mang đến trải nghiệm chơi game mạnh mẽ.",
  },
] as const;
