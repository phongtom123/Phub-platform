import styles from "./engagement.module.css";

export function ReviewStars({ value }: { value: number }) {
  const rating = Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;
  return <span className={styles.reviewStars} role="img" aria-label={`${rating} trên 5 sao`}>
    {[1, 2, 3, 4, 5].map(point => <svg key={point} viewBox="0 0 24 24" aria-hidden="true"
      className={point <= rating ? styles.reviewStarFilled : styles.reviewStarEmpty}
      fill={point <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <path d="m12 3 2.8 5.7 6.3.9-4.55 4.45 1.07 6.28L12 17.36l-5.62 2.97 1.07-6.28L2.9 9.6l6.3-.9L12 3Z" />
    </svg>)}
  </span>;
}
