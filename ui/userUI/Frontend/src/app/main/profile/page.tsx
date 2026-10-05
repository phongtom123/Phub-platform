import type { Metadata } from "next";
import { PageHeading } from "@/components/common/PageHeading";
import { AccountDashboard } from "./AccountDashboard";
import styles from "./profile.module.css";

export const metadata: Metadata = {
  title: "My Dashboard | Tech Store",
  description: "Account dashboard UI preview.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <div className={styles.page}>
    <PageHeading title="My Dashboard" breadcrumbs={[{ label: "Home", href: "/" }, { label: "My Dashboard" }]} />
    <AccountDashboard />
  </div>;
}
