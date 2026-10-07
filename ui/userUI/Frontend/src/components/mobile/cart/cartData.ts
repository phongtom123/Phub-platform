export interface CartProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export const initialCartProducts: CartProduct[] = [
  {
    id: "trident-desktop",
    name: "MSI MEG Trident X 10SD-1012AU Intel i7 10700K, 2070 SUPER, 32GB RAM, 1TB SSD, Windows 10 Home, Gaming Keyboard and Mouse 3 Years Warranty",
    image: "/images/home/desktop-trident.svg",
    price: 4349,
    quantity: 1,
  },
  {
    id: "prestige-laptop",
    name: "MSI MEG Trident X 10SD-1012AU Intel i7 10700K, 2070 SUPER, 32GB RAM, 1TB SSD, Windows 10 Home, Gaming Keyboard and Mouse 3 Years Warranty",
    image: "/images/catalog/prestige-front.webp",
    price: 4349,
    quantity: 1,
  },
];

export const cartPage1Data = {
  breadcrumbs: [
    { label: "Trang chủ", href: "/" },
    { label: "Giỏ hàng" },
  ],
  title: "Giỏ hàng",
  summaryTitle: "Tóm tắt đơn hàng",
  estimateShippingTitle: "Ước tính phí vận chuyển & thuế",
  estimateShippingDesc: "Nhập địa chỉ nhận hàng để nhận ước tính cước phí vận chuyển.",
  applyDiscountTitle: "Áp dụng mã giảm giá",
  discountPlaceholder: "Nhập mã ưu đãi (thử: TECH10)",
  applyDiscountBtn: "Áp dụng",
  shippingOptions: [
    {
      id: "standard",
      name: "Giao hàng tiêu chuẩn",
      description: "Giá có thể thay đổi tùy theo khu vực nhận hàng. Nhân viên cửa hàng sẽ liên hệ xác nhận với bạn.",
      cost: 21,
    },
    {
      id: "pickup",
      name: "Nhận tại cửa hàng",
      description: "1234 Nguyễn Thị Minh Khai, Phường 5, Quận 1, TP. HCM",
      cost: 0,
    },
  ],
  labels: {
    price: "Đơn giá",
    qty: "Số lượng",
    subtotal: "Tạm tính",
    shipping: "Phí vận chuyển",
    shippingNote: "(Cước phí tiêu chuẩn - Giá có thể thay đổi tùy thuộc vào mặt hàng/điểm đến. Nhân viên Shop sẽ liên hệ với bạn.)",
    tax: "Thuế",
    gst: "GST (10%)",
    orderTotal: "Tổng thanh toán",
    proceedCheckout: "Tiến hành thanh toán",
    paypalCheckout: "Thanh toán với PayPal",
    multipleAddresses: "Thanh toán nhiều địa chỉ",
    zipText: "Sở hữu ngay, trả góp 0% lãi suất lên đến 6 tháng",
    zipLearnMore: "tìm hiểu thêm",
    updateCart: "Cập nhật giỏ hàng",
    emptyCart: "Giỏ hàng của bạn đang trống.",
    continueShopping: "Tiếp tục mua sắm",
  },
};
