import type { ImgHTMLAttributes } from "react";
import styles from "./common.module.css";

export interface BrandTileProps extends ImgHTMLAttributes<HTMLImageElement> {
  name: string;
}

export function BrandTile({ name, alt, className, ...props }: BrandTileProps) {
  return (
    <div className={styles.brandTile}>
      <img {...props} alt={alt ?? name} className={[styles.brandImage, className].filter(Boolean).join(" ")} />
    </div>
  );
}