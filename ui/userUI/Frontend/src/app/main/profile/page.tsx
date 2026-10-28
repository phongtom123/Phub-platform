import type { Metadata } from "next";
import { PageHeading } from "@/components/common/PageHeading";
import ConnectedAccount from "./ConnectedAccount";
import styles from "./profile.module.css";

export const metadata: Metadata = {
  title: "Tài khoản | PHUB Store",
  description: "Thông tin và đơn hàng của tài khoản đang đăng nhập.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <div className={styles.page}>
    <PageHeading title="My Dashboard" breadcrumbs={[{ label: "Home", href: "/" }, { label: "My Dashboard", href: "/main/profile" }]} />
    <ConnectedAccount />
  </div>;
}
