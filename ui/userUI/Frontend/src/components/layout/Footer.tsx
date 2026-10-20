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
            <address className={styles.address}><p>Thông tin liên hệ chưa được cấu hình.</p></address>
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
          <p className={styles.copyright}>Bản quyền © 2026 PHUB. Đã bảo lưu mọi quyền.</p>
        </div>
      </div>
    </footer>
  );
}
