import Link from "next/link";
import { ContactForm } from "./ContactForm";
import styles from "./contact.module.css";
export default function ContactUsPage() {
  return <div className={styles.page}><div className={styles.container}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Trang chủ</Link><span>›</span><strong>Liên hệ</strong></nav>
    <h1>Liên hệ</h1><div className={styles.layout}>
      <section className={styles.content}><p>Gửi liên hệ chưa được kết nối API.</p><ContactForm /></section>
      <aside className={styles.contactCard}><h2>Thông tin cửa hàng</h2><p>Địa chỉ, số điện thoại và giờ mở cửa chưa được cấu hình.</p></aside>
    </div></div></div>;
}
