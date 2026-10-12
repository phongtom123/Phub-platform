import type { Metadata } from "next";
import "./globals.css";
import "../../shared/data-manager.css";

export const metadata: Metadata = {
  title: "PHUB · Kho vận",
  description: "Giao diện nghiệp vụ dành cho nhân viên kho PHUB.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
