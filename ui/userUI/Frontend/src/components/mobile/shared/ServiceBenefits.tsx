import Image from "next/image";
import { serviceBenefits } from "./serviceBenefitsData";
import styles from "@/components/home/Home.module.css";

export function ServiceBenefits() {
  return <section className={styles.benefits} aria-label="Lợi ích khi mua sắm">
    {serviceBenefits.map(benefit => <article key={benefit.id}>
      <Image src={benefit.icon} alt="" width={45} height={45} />
      <h2>{benefit.title}</h2>
      <p>{benefit.description}</p>
    </article>)}
  </section>;
}
