import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthProvider } from "@/src/components/admin/auth-provider";
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
      <body><AuthProvider><Suspense fallback={<main className="session-gate">Đang tải trang…</main>}>{children}</Suspense></AuthProvider></body>
    </html>
  );
}
