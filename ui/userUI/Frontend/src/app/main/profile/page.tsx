import type { Metadata } from "next";
import { PageHeading } from "@/components/common/PageHeading";
import ConnectedAccount from "./ConnectedAccount";
import styles from "./profile.module.css";
import { accountNavigation, engagementNavigation } from './accountData';

export const metadata: Metadata = {
  title: "Tài khoản | PHUB Store",
  description: "Thông tin và đơn hàng của tài khoản đang đăng nhập.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const initialView = [...accountNavigation, ...engagementNavigation].find(item => item.id === view)?.id ?? 'account';
  return <div className={styles.page}>
    <PageHeading title="Tài khoản của tôi" breadcrumbs={[{ label: "Trang chủ", href: "/" }, { label: "Tài khoản", href: "/main/profile" }]} />
    <ConnectedAccount initialView={initialView} />
  </div>;
}
