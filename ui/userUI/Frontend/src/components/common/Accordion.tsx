import Image from "next/image";
import type { DetailsHTMLAttributes, ReactNode } from "react";
import styles from "./store.module.css";

export interface AccordionProps extends Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "title"> {
  title: ReactNode;
}

export function Accordion({ title, children, className, ...props }: AccordionProps) {
  return (
    <details {...props} className={[styles.accordion, className].filter(Boolean).join(" ")}>
      <summary>{title}<Image src="/icons/tech-store/accordion-up.svg" alt="" width={16} height={16} /></summary>
      <div className={styles.accordionContent}>{children}</div>
    </details>
  );
}
