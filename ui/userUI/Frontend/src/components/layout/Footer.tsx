import Image from "next/image";
import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";
import { FooterLinkGroup } from "./FooterLinkGroup";
import { footerSections, paymentMethods } from "./footerData";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        <section className={styles.newsletter} aria-labelledby="newsletter-heading">
          <div className={styles.newsletterText}>
            <h2 id="newsletter-heading">Đăng Ký Nhận Bản Tin</h2>
            <p>Nhận thông tin ưu đãi và mã giảm giá mới nhất ngay hôm nay.</p>
          </div>
          <NewsletterForm />
        </section>

        <div className={styles.footerLinks}>
          {footerSections.map((section, index) => (
            <FooterLinkGroup key={section.title} title={section.title} initiallyOpen={index === 1}>
              <ul>
                {section.links.map(link => (
                  <li key={link.label}>
                    {link.href ? <Link href={link.href}>{link.label}</Link> : <span>{link.label}</span>}
                  </li>
                ))}
              </ul>
            </FooterLinkGroup>
          ))}

          <FooterLinkGroup id="footer-contact" title="Liên hệ">
            <address className={styles.address}>
              <p>Địa chỉ: 1234 Nguyễn Thị Minh Khai, Phường 5, Quận 1, TP. HCM</p>
              <p>Hotline: <a href="tel:0901234567">090 123 4567</a></p>
              <p>Giờ làm việc: Thứ 2 - Thứ 5: 9:00 AM – 5:30 PM</p>
              <p>Thứ 6: 9:00 AM – 6:00 PM | Thứ 7: 11:00 AM – 5:00 PM</p>
              <p>E-mail: <a href="mailto:cskh@techstore.vn">cskh@techstore.vn</a></p>
            </address>
          </FooterLinkGroup>
        </div>

        <div className={styles.footerBottom}>
          {/* No social profile URLs have been configured yet. */}
          <div className={styles.social}>
            <Image src="/icons/footer/facebook.svg" alt="Facebook" width={22} height={22} />
            <Image src="/icons/footer/instagram.svg" alt="Instagram" width={22} height={22} />
          </div>
          <ul className={styles.payment} aria-label="Phương thức thanh toán">
            {paymentMethods.map(method => (
              <li key={method.name}><Image src={method.src} alt={method.name} width={25} height={25} /></li>
            ))}
          </ul>
          <p className={styles.copyright}>Bản quyền © 2026 TechStore Việt Nam. Đã bảo lưu mọi quyền.</p>
        </div>
      </div>
    </footer>
  );
}
