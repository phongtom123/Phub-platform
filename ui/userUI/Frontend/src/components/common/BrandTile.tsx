import type { ImgHTMLAttributes } from "react";
import styles from "./common.module.css";

export interface BrandTileProps extends ImgHTMLAttributes<HTMLImageElement> {
  name: string;
  containerClassName?: string;
  mobileSrc?: string;
}

export function BrandTile({ name, alt, className, containerClassName, mobileSrc, ...props }: BrandTileProps) {
  return (
    <div className={[styles.brandTile, containerClassName].filter(Boolean).join(" ")}>
      <picture>
        {mobileSrc && <source media="(max-width: 760px)" srcSet={mobileSrc} />}
        <img {...props} alt={alt ?? name} className={[styles.brandImage, className].filter(Boolean).join(" ")} />
      </picture>
    </div>
  );
}
