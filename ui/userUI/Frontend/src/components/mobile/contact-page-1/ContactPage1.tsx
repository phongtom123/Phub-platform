import { Breadcrumb } from "@/components/common/Breadcrumb";
import { ServiceBenefits } from "@/components/mobile/shared/ServiceBenefits";
import { ContactPage1Form } from "./ContactPage1Form";
import { ContactInfoCard } from "./ContactInfoCard";
import { contactPage1Data } from "./contactPage1Data";
import styles from "./ContactPage1.module.css";

export function ContactPage1() {
  return (
    <article className={styles.page}>
      <Breadcrumb
        items={contactPage1Data.breadcrumbs}
        className={styles.breadcrumb}
      />
      <h1 className={styles.title}>{contactPage1Data.title}</h1>
      <p className={styles.intro}>{contactPage1Data.intro}</p>
      <ContactPage1Form />
      <ContactInfoCard />
      <ServiceBenefits />
    </article>
  );
}
