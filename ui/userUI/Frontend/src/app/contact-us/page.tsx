import Link from "next/link";
import { ContactForm } from "./ContactForm";
import styles from "./contact.module.css";

export default function ContactUsPage() {
  return <div className={styles.page}><div className={styles.container}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/">Home</Link><span>›</span><strong>Contact Us</strong></nav>
    <h1>Contact Us</h1>
    <div className={styles.layout}>
      <section className={styles.content} aria-labelledby="contact-intro">
        <div id="contact-intro" className={styles.intro}><p>We love hearing from you, our Shop customers.</p><p>Please contact us and we will make sure to get back to you as soon as we possibly can.</p></div>
        <ContactForm />
      </section>
      <aside className={styles.contactCard} aria-label="Store contact information">
        <ContactItem icon={<PinIcon />} title="Address:"><p>1234 Street Adress City Address, 1234</p></ContactItem>
        <ContactItem icon={<PhoneIcon />} title="Phone:"><p><a href="tel:0012345678">(00)1234 5678</a></p></ContactItem>
        <ContactItem icon={<ClockIcon />} title="We are open:"><p>Monday – Thursday: 9:00 AM – 5:30 PM<br />Friday 9:00 AM – 6:00 PM<br />Saturday: 11:00 AM – 5:00 PM</p></ContactItem>
        <ContactItem icon={<MailIcon />} title="E-mail:"><p><a className={styles.blueLink} href="mailto:shop@email.com">shop@email.com</a></p></ContactItem>
      </aside>
    </div>
  </div><div className={styles.bottomSpace} /></div>;
}

function ContactItem({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <div className={styles.contactItem}><div className={styles.icon}>{icon}</div><div><h2>{title}</h2>{children}</div></div>; }
const svgProps = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function PinIcon(){return <svg {...svgProps}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>}
function PhoneIcon(){return <svg {...svgProps}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c1 .4 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/></svg>}
function ClockIcon(){return <svg {...svgProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v6h5"/></svg>}
function MailIcon(){return <svg {...svgProps}><circle cx="12" cy="12" r="9"/><path d="m7 9 5 4 5-4v7H7V9Z"/></svg>}
