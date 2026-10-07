import Image from "next/image";
import Link from "next/link";
import { testimonials } from "./testimonialsData";
import styles from "@/components/home/Home.module.css";

export function CustomerTestimonials() {
  const review = testimonials[0];
  return <section className={styles.testimonials} aria-label="Đánh giá từ khách hàng">
    <span className={styles.quoteMark} aria-hidden="true">‘’</span>
    <blockquote><p>{review.quote}</p><cite>– {review.author}</cite></blockquote>
    <div className={styles.reviewActions}>
      <Link href="/contact-us">Gửi đánh giá</Link>
      <Image src="/images/figma-mobile/home-imgComponent17.svg" width={60} height={9} alt="" />
    </div>
  </section>;
}
