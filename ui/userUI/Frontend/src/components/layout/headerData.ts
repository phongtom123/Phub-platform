export const guestAccountItems = ["Đăng nhập", "Tạo tài khoản mới"] as const;

export const storeInfo = {
  phone: "(00) 1234 5678",
  phoneHref: "tel:+0012345678",
  email: "shop@email.com",
  address: "1234 Street Address, City Address, 1234",
  hours: [
    { days: "Mon–Thu", time: "9:00 AM – 5:30 PM" },
    { days: "Fri", time: "9:00 AM – 6:00 PM" },
    { days: "Sat", time: "11:00 AM – 5:00 PM" },
  ],
} as const;
