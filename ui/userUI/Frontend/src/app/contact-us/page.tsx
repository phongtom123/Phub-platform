import Link from "next/link";
import { storeInfo } from "@/components/layout/headerData";
import { ContactForm } from "./ContactForm";
import styles from "./contact.module.css";

export default function ContactUsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/">Trang chủ</Link>
          <span>›</span>
          <strong>Liên hệ & Hỗ trợ</strong>
        </nav>
        <h1>Liên hệ & Hỗ trợ khách hàng</h1>
        <div className={styles.layout}>
          <section className={styles.content}>
            <div className={styles.intro}>
              <p>
                Gửi câu hỏi tư vấn sản phẩm, kiểm tra bảo hành hoặc hỗ trợ đơn hàng trực tiếp tới đội ngũ quản trị PHUB.
                Mỗi yêu cầu được cấp mã theo dõi riêng và lưu trong lịch sử tài khoản của bạn.
              </p>
            </div>
            <ContactForm />
          </section>
          <aside className={styles.contactCard}>
            <div className={styles.contactItem}>
              <span className={styles.icon} aria-hidden="true">📍</span>
              <div>
                <h2>Địa chỉ cửa hàng</h2>
                <p>{storeInfo.address}</p>
              </div>
            </div>
            <div className={styles.contactItem}>
              <span className={styles.icon} aria-hidden="true">📞</span>
              <div>
                <h2>Điện thoại</h2>
                <p>
                  <a href={storeInfo.phoneHref}>{storeInfo.phone}</a>
                </p>
              </div>
            </div>
            <div className={styles.contactItem}>
              <span className={styles.icon} aria-hidden="true">🕒</span>
              <div>
                <h2>Giờ mở cửa</h2>
                {storeInfo.hours.map((item) => (
                  <p key={item.days}>
                    {item.days}: {item.time}
                  </p>
                ))}
              </div>
            </div>
            <div className={styles.contactItem}>
              <span className={styles.icon} aria-hidden="true">✉️</span>
              <div>
                <h2>E-mail</h2>
                <p>
                  <a className={styles.blueLink} href={`mailto:${storeInfo.email}`}>
                    {storeInfo.email}
                  </a>
                </p>
              </div>
            </div>
          </aside>
        </div>
        <div className={styles.bottomSpace} />
      </div>
    </div>
  );
}
