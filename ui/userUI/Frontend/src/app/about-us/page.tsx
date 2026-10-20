import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/common/PageHeading";
import styles from "./page.module.css";
export const metadata: Metadata = { title: "Về PHUB", description: "Nền tảng bán PC và linh kiện." };
export default function AboutUsPage() {
  return <div className={styles.page}><PageHeading title="Về PHUB" breadcrumbs={[{ label: "Trang chủ", href: "/" }, { label: "Về PHUB" }]} />
    <section className={styles.row}><div className={styles.copy}><h2>PC nguyên bộ và linh kiện</h2><p>Thông tin giới thiệu cửa hàng đang được cập nhật.</p><Link href="/main/product">Xem sản phẩm</Link></div></section>
  </div>;
}
