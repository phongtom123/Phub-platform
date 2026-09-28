import type { ImgHTMLAttributes } from "react";
import styles from "./common.module.css";

export interface BrandTileProps extends ImgHTMLAttributes<HTMLImageElement> {
  name: string;
  containerClassName?: string;
}

export function BrandTile({ name, alt, className, containerClassName, ...props }: BrandTileProps) {
  return (
    <div className={[styles.brandTile, containerClassName].filter(Boolean).join(" ")}>
      <img {...props} alt={alt ?? name} className={[styles.brandImage, className].filter(Boolean).join(" ")} />
    </div>
  );
}
