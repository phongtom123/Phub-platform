import type { Metadata } from "next";
import "./globals.css";
import "../../shared/data-manager.css";
import "@/src/features/accounts/accounts.css";
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
