import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PHUB Admin",
  description: "Quản trị cửa hàng PC và linh kiện",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
