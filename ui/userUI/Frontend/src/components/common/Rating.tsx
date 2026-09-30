import Image from "next/image";
import styles from "./store.module.css";

export interface RatingProps {
  value: number;
  reviewCount?: number;
  className?: string;
  locale?: "en" | "vi";
  compact?: boolean;
}

export function Rating({ value, reviewCount, className, locale = "en", compact = false }: RatingProps) {
  const rating = Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;
  return (
    <div className={[styles.rating, compact && styles.compactRating, className].filter(Boolean).join(" ")}>
      <span className={styles.stars} role="img" aria-label={locale === "vi" ? `${rating} trên 5 sao` : `${rating} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => (
          <span className={styles.star} key={index} aria-hidden="true">
            <Image src="/icons/tech-store/star-empty.svg" alt="" width={13} height={13} />
            <span className={styles.starFill} style={{ width: `${Math.min(1, Math.max(0, rating - index)) * 100}%` }}>
              <Image src="/icons/tech-store/star-filled.svg" alt="" width={13} height={13} />
            </span>
          </span>
        ))}
      </span>
      {reviewCount !== undefined && <span className={styles.reviewCount}>{locale === "vi" ? "Đánh giá" : "Reviews"} ({reviewCount})</span>}
    </div>
  );
}
