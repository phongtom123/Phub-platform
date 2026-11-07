import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthProvider } from "@internal/components/admin/auth-provider";
import "../../adminUI/app/globals.css";
import "../../shared/data-manager.css";
import "@internal/features/accounts/accounts.css";
import "@/src/features/receipts/receipts.css";
export const metadata: Metadata = { title: "PHUB · Nhân viên", description: "Nghiệp vụ cửa hàng PHUB" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi" suppressHydrationWarning><body><AuthProvider portal="staff"><Suspense fallback={<main className="session-gate">Đang tải trang…</main>}>{children}</Suspense></AuthProvider></body></html>;
}
