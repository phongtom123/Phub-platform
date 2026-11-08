"use client";
import { useState } from "react";
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

export function StarRatingInput({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Điểm đánh giá",
  required = false,
}: {
  value: number | null;
  onChange: (val: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  required?: boolean;
}) {
  const [hoverVal, setHoverVal] = useState<number | null>(null);
  const active = hoverVal ?? value ?? 0;

  const scoreLabels: Record<number, string> = {
    1: "1 / 5 sao - Rất không hài lòng",
    2: "2 / 5 sao - Không hài lòng",
    3: "3 / 5 sao - Bình thường",
    4: "4 / 5 sao - Hài lòng",
    5: "5 / 5 sao - Rất hài lòng",
  };

  return (
    <div className={styles.starPickerWrapper}>
      <div
        className={styles.starPicker}
        role="radiogroup"
        aria-label={ariaLabel}
        onMouseLeave={() => setHoverVal(null)}
      >
        {[1, 2, 3, 4, 5].map((point) => {
          const isFilled = point <= active;
          return (
            <button
              key={point}
              type="button"
              disabled={disabled}
              className={`${styles.starBtn} ${isFilled ? styles.starBtnFilled : styles.starBtnEmpty}`}
              onClick={() => onChange(point)}
              onMouseEnter={() => !disabled && setHoverVal(point)}
              onFocus={() => !disabled && setHoverVal(point)}
              onBlur={() => setHoverVal(null)}
              role="radio"
              aria-checked={value === point}
              aria-label={`${point} sao`}
            >
              <svg
                viewBox="0 0 24 24"
                className={styles.starPickerSvg}
                fill={isFilled ? "#e6a323" : "#ffffff"}
                stroke="#e6a323"
                strokeWidth="1.8"
                strokeLinejoin="round"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m12 3 2.8 5.7 6.3.9-4.55 4.45 1.07 6.28L12 17.36l-5.62 2.97 1.07-6.28L2.9 9.6l6.3-.9L12 3Z" />
              </svg>
            </button>
          );
        })}
      </div>
      <span className={styles.starLabelText}>
        {active > 0 ? scoreLabels[active] : (required ? "Vui lòng chọn số sao *" : "Chưa chọn điểm")}
      </span>
    </div>
  );
}
